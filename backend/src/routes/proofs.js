const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const StellarSDK = require("@stellar/stellar-sdk");
const { ClientEncryptionService } = require("../security/clientEncryption");
const { PrivacyControlsService } = require("../security/privacyControls");
const { IPFSService } = require("../services/ipfsService");
const { PinningService } = require("../services/pinningService");
const { IPNSService } = require("../services/ipnsService");
const { ContentVerification } = require("../utils/contentVerification");
const IPFSContent = require("../models/IPFSContent");
const ipfsConfig = require("../../config/ipfsConfig");
const { cacheMiddleware, invalidateCacheMiddleware } = require("../middleware/cacheMiddleware");

// Initialize IPFS services
const ipfsService = new IPFSService();
const pinningService = new PinningService();
const ipnsService = new IPNSService();
const contentVerification = new ContentVerification();

// Mock storage - replace with database
let proofs = [];
let proofIdCounter = 1;

// Issue a new proof - invalidate proof list cache on success
router.post(
  "/issue",
  invalidateCacheMiddleware({ tags: ["proof-data"] }),
  [
    body("eventData").notEmpty().withMessage("Event data is required"),
    body("hash")
      .isLength({ min: 64 })
      .withMessage("Hash must be at least 64 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        eventData,
        hash,
        issuerAddress,
        encryptionPassword,
        privacySettings,
        storeOnIPFS = true,
        ipnsName = null,
      } = req.body;

      // Handle encryption if requested
      let processedEventData = eventData;
      let encrypted = false;

      if (encryptionPassword) {
        processedEventData = ClientEncryptionService.encrypt(
          eventData,
          encryptionPassword,
        );
        encrypted = true;
      }

      // Set privacy controls
      const privacyService = new PrivacyControlsService();
      const finalPrivacySettings = privacyService.createPrivacySettings(
        privacySettings || {},
      );

      const proof = {
        id: proofIdCounter++,
        issuer: issuerAddress,
        eventData: processedEventData,
        hash,
        timestamp: new Date().toISOString(),
        verified: false,
        stellarTxId: null,
        encrypted,
        privacySettings: finalPrivacySettings,
      };

      // Store on IPFS if requested
      let ipfsResult = null;
      if (storeOnIPFS) {
        try {
          // Initialize IPFS services
          await ipfsService.initialize();
          await pinningService.initialize();

          // Add content to IPFS
          ipfsResult = await ipfsService.addContent(proof, {
            pin: true,
            wrapWithDirectory: false,
          });

          // Create database record
          const ipfsContent = new IPFSContent({
            cid: ipfsResult.cid,
            name: `proof-${proof.id}`,
            description: `Proof issued by ${issuerAddress}`,
            contentType: "proof",
            size: ipfsResult.size,
            hash: hash,
            owner: issuerAddress,
            issuer: issuerAddress,
            privacySettings: {
              public: finalPrivacySettings.public || false,
              allowedUsers: finalPrivacySettings.allowedUsers || [],
              allowedRoles: finalPrivacySettings.allowedRoles || [],
              encryptionEnabled: encrypted,
            },
            pinning: {
              isPinned: true,
              pinningStrategy: "immediate",
              pinningPriority: "high",
              pinnedAt: new Date(),
            },
            verification: {
              contentHash: hash,
              verified: false,
              verificationAttempts: 0,
            },
          });

          await ipfsContent.save();

          // Publish to IPNS if name provided
          if (ipnsName) {
            try {
              await ipnsService.initialize();
              const ipnsRecord = await ipnsService.publishToIPNS(
                ipnsName,
                ipfsResult.cid,
              );
              proof.ipnsName = ipnsName;
              proof.ipnsRecord = ipnsRecord;
            } catch (ipnsError) {
              console.warn("IPNS publishing failed:", ipnsError.message);
            }
          }

          // Verify content integrity
          try {
            const verificationResult =
              await contentVerification.verifyIPFSContent(
                ipfsService,
                ipfsResult.cid,
                hash,
              );

            ipfsContent.verification.verified = verificationResult.verified;
            ipfsContent.verification.verifiedAt = new Date();
            await ipfsContent.save();
          } catch (verificationError) {
            console.warn(
              "Content verification failed:",
              verificationError.message,
            );
          }

          proof.ipfsCid = ipfsResult.cid;
          proof.ipfsSize = ipfsResult.size;
          proof.gatewayURL = `http://localhost:8080/ipfs/${ipfsResult.cid}`;
        } catch (ipfsError) {
          console.error("IPFS storage failed:", ipfsError);
          // Continue without IPFS storage
        }
      }

      proofs.push(proof);

      res.status(201).json({
        success: true,
        proof,
        ipfs: ipfsResult,
        message: "Proof issued successfully",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get proof by ID - cache 30 min
router.get("/:id", cacheMiddleware({
  ttl: 1800,
  keyPrefix: "proof",
  keyGenerator: (req) => `id:${req.params.id}:user:${req.query.userAddress || "anonymous"}`,
  tags: ["proof-data"]
}), async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    // Apply privacy controls
    const privacyService = new PrivacyControlsService();
    const userAddress = req.query.userAddress || "anonymous"; // In real implementation, this would come from auth
    const requestedActions = req.query.actions
      ? req.query.actions.split(",")
      : ["view"];

    const canAccess = privacyService.canAccess(
      proof.privacySettings,
      userAddress,
      requestedActions,
    );

    if (!canAccess.allowed) {
      return res.status(403).json({ error: canAccess.reason });
    }

    // Apply privacy filter to the proof data
    const filteredProof = privacyService.applyPrivacyFilter(
      proof,
      proof.privacySettings,
      userAddress,
    );

    // If proof has IPFS CID, retrieve content from IPFS
    if (proof.ipfsCid && req.query.includeContent === "true") {
      try {
        await ipfsService.initialize();
        const ipfsContent = await ipfsService.getContentAsJSON(proof.ipfsCid);
        filteredProof.ipfsContent = ipfsContent;
      } catch (ipfsError) {
        console.warn("Failed to retrieve IPFS content:", ipfsError.message);
        filteredProof.ipfsContent = null;
      }
    }

    res.json({ proof: filteredProof });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all proofs - cache 5 min
router.get("/", cacheMiddleware({
  ttl: 300,
  keyPrefix: "proof",
  keyGenerator: (req) => `list:${JSON.stringify(req.query)}`,
  tags: ["proof-data"]
}), (req, res) => {
  const { issuer, verified } = req.query;
  let filteredProofs = proofs;

  if (issuer) {
    filteredProofs = filteredProofs.filter((p) => p.issuer === issuer);
  }

  if (verified !== undefined) {
    filteredProofs = filteredProofs.filter(
      (p) => p.verified === (verified === "true"),
    );
  }

  res.json({ proofs: filteredProofs });
});

// Verify a proof - invalidate proof cache after verification changes state
router.post("/verify/:id", invalidateCacheMiddleware({
  tags: ["proof-data", "proof-verification"]
}), async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    // Apply privacy controls for verification
    const privacyService = new PrivacyControlsService();
    const userAddress = req.body.verifierAddress || "anonymous"; // In real implementation, this would come from auth
    const requestedActions = ["verify"];

    const canAccess = privacyService.canAccess(
      proof.privacySettings,
      userAddress,
      requestedActions,
    );

    if (!canAccess.allowed) {
      return res.status(403).json({ error: canAccess.reason });
    }

    // Check if selective disclosure is needed
    const selectiveFields = req.body.selectiveFields || [];

    if (selectiveFields.length > 0) {
      // Apply selective disclosure
      const disclosureService = new SelectiveDisclosureService();

      // Create a temporary policy for verification
      const policy = await disclosureService.createDisclosurePolicy(
        proof,
        selectiveFields,
        "Verification request",
        userAddress,
        "temp-key", // In real implementation, use proper key
      );

      const selectiveData = disclosureService.generateSelectiveDisclosure(
        proof,
        policy,
      );

      // Mock verification on the selectively disclosed data
      proof.verified = true;
      proof.verifiedAt = new Date().toISOString();

      res.json({
        success: true,
        proof: selectiveData.disclosedData, // Return only selectively disclosed data
        message: "Proof verified successfully with selective disclosure",
      });
    } else {
      // Standard verification
      proof.verified = true;
      proof.verifiedAt = new Date().toISOString();

      res.json({
        success: true,
        proof,
        message: "Proof verified successfully",
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IPFS-specific routes

// Pin proof content
router.post("/:id/pin", async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    if (!proof.ipfsCid) {
      return res.status(400).json({ error: "Proof not stored on IPFS" });
    }

    await pinningService.initialize();
    const pinResult = await pinningService.pinContent(proof.ipfsCid, {
      strategy: req.body.strategy || "immediate",
      priority: req.body.priority || "high",
      metadata: {
        proofId: proof.id,
        issuer: proof.issuer,
        timestamp: proof.timestamp,
      },
    });

    res.json({
      success: true,
      pinResult,
      message: "Proof pinned successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unpin proof content
router.delete("/:id/pin", async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    if (!proof.ipfsCid) {
      return res.status(400).json({ error: "Proof not stored on IPFS" });
    }

    await pinningService.initialize();
    const unpinResult = await pinningService.unpinContent(proof.ipfsCid);

    res.json({
      success: true,
      unpinResult,
      message: "Proof unpinned successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get IPFS content for proof
router.get("/:id/ipfs", async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    if (!proof.ipfsCid) {
      return res.status(400).json({ error: "Proof not stored on IPFS" });
    }

    await ipfsService.initialize();
    const content = await ipfsService.getContent(proof.ipfsCid);

    res.set({
      "Content-Type": "application/json",
      "Content-Length": content.length,
      "X-IPFS-CID": proof.ipfsCid,
      "X-Proof-ID": proof.id,
    });

    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify IPFS content integrity
router.post("/:id/verify-ipfs", async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    if (!proof.ipfsCid) {
      return res.status(400).json({ error: "Proof not stored on IPFS" });
    }

    await ipfsService.initialize();
    const verificationResult = await contentVerification.verifyIPFSContent(
      ipfsService,
      proof.ipfsCid,
      proof.hash,
    );

    // Update database record
    const ipfsContent = await IPFSContent.findOne({ cid: proof.ipfsCid });
    if (ipfsContent) {
      ipfsContent.verification.verified = verificationResult.verified;
      ipfsContent.verification.verifiedAt = new Date();
      ipfsContent.verification.verificationAttempts += 1;
      await ipfsContent.save();
    }

    res.json({
      success: true,
      verification: verificationResult,
      message: verificationResult.verified
        ? "Content verified successfully"
        : "Content verification failed",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update IPNS record for proof
router.post("/:id/ipns", async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    if (!proof.ipfsCid) {
      return res.status(400).json({ error: "Proof not stored on IPFS" });
    }

    const { ipnsName } = req.body;
    if (!ipnsName) {
      return res.status(400).json({ error: "IPNS name is required" });
    }

    await ipnsService.initialize();
    const ipnsRecord = await ipnsService.publishToIPNS(ipnsName, proof.ipfsCid);

    // Update proof record
    proof.ipnsName = ipnsName;
    proof.ipnsRecord = ipnsRecord;

    res.json({
      success: true,
      ipnsRecord,
      message: "IPNS record updated successfully",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get IPFS statistics for proof
router.get("/:id/ipfs-stats", async (req, res) => {
  try {
    const proof = proofs.find((p) => p.id === parseInt(req.params.id));
    if (!proof) {
      return res.status(404).json({ error: "Proof not found" });
    }

    if (!proof.ipfsCid) {
      return res.status(400).json({ error: "Proof not stored on IPFS" });
    }

    // Get database record
    const ipfsContent = await IPFSContent.findOne({ cid: proof.ipfsCid });
    if (!ipfsContent) {
      return res.status(404).json({ error: "IPFS content record not found" });
    }

    // Get pinning status
    await pinningService.initialize();
    const pinningStatus = await pinningService.getPinningStatus(proof.ipfsCid);

    // Get IPNS records if available
    let ipnsRecords = [];
    if (proof.ipnsName) {
      try {
        await ipnsService.initialize();
        const ipnsStats = await ipnsService.getStats();
        ipnsRecords = ipnsStats.keys.filter(
          (key) => key.name === proof.ipnsName,
        );
      } catch (ipnsError) {
        console.warn("Failed to get IPNS records:", ipnsError.message);
      }
    }

    res.json({
      cid: proof.ipfsCid,
      size: proof.ipfsSize,
      gatewayURL: proof.gatewayURL,
      uploadedAt: ipfsContent.uploadedAt,
      pinning: ipfsContent.pinning,
      verification: ipfsContent.verification,
      metrics: ipfsContent.metrics,
      pinningStatus,
      ipnsRecords,
      privacySettings: ipfsContent.privacySettings,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
