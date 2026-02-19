import React from 'react';

interface Props {
    oldVersion: any;
    newVersion: any;
}

const VersionComparison: React.FC<Props> = ({ oldVersion, newVersion }) => {
    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="border p-4 rounded bg-red-50">
                <h4 className="font-bold mb-2">Version {oldVersion.versionNumber}</h4>
                <pre className="whitespace-pre-wrap text-sm text-red-700">{oldVersion.eventData}</pre>
            </div>
            <div className="border p-4 rounded bg-green-50">
                <h4 className="font-bold mb-2">Version {newVersion.versionNumber}</h4>
                <pre className="whitespace-pre-wrap text-sm text-green-700">{newVersion.eventData}</pre>
            </div>
        </div>
    );
};

export default VersionComparison;