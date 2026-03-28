package verinode

import (
	"fmt"
)

// ErrorCode represents different types of errors
type ErrorCode string

const (
	ErrCodeAPIError         ErrorCode = "API_ERROR"
	ErrCodeAuthError        ErrorCode = "AUTH_ERROR"
	ErrCodeValidationError  ErrorCode = "VALIDATION_ERROR"
	ErrCodeNetworkError     ErrorCode = "NETWORK_ERROR"
	ErrCodeWalletError      ErrorCode = "WALLET_ERROR"
	ErrCodeProofError       ErrorCode = "PROOF_ERROR"
	ErrCodeVerificationError ErrorCode = "VERIFICATION_ERROR"
	ErrCodeSubscriptionError ErrorCode = "SUBSCRIPTION_ERROR"
)

// Error is the base error type for all Verinode SDK errors
type Error struct {
	Code      ErrorCode     `json:"code"`
	Message   string        `json:"message"`
	Details   interface{}   `json:"details,omitempty"`
	StatusCode int          `json:"status_code,omitempty"`
}

// Error implements the error interface
func (e *Error) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("[%s] %s", e.Code, e.Message)
	}
	return e.Message
}

// Unwrap returns the underlying error if any
func (e *Error) Unwrap() error {
	if e.Details != nil {
		if err, ok := e.Details.(error); ok {
			return err
		}
	}
	return nil
}

// NewError creates a new Error
func NewError(code ErrorCode, message string, details interface{}) *Error {
	return &Error{
		Code:    code,
		Message: message,
		Details: details,
	}
}

// NewAPIError creates a new API error
func NewAPIError(message string, statusCode int, details interface{}) *Error {
	return &Error{
		Code:       ErrCodeAPIError,
		Message:    message,
		Details:    details,
		StatusCode: statusCode,
	}
}

// NewAuthError creates a new authentication error
func NewAuthError(message string) *Error {
	return &Error{
		Code:    ErrCodeAuthError,
		Message: message,
	}
}

// NewValidationError creates a new validation error
func NewValidationError(message, field string) *Error {
	details := map[string]interface{}{"field": field}
	return &Error{
		Code:    ErrCodeValidationError,
		Message: message,
		Details: details,
	}
}

// NewNetworkError creates a new network error
func NewNetworkError(message string) *Error {
	return &Error{
		Code:    ErrCodeNetworkError,
		Message: message,
	}
}

// NewWalletError creates a new wallet error
func NewWalletError(message, walletType string) *Error {
	details := map[string]interface{}{"wallet_type": walletType}
	return &Error{
		Code:    ErrCodeWalletError,
		Message: message,
		Details: details,
	}
}

// NewProofError creates a new proof error
func NewProofError(message, proofID string) *Error {
	details := map[string]interface{}{"proof_id": proofID}
	return &Error{
		Code:    ErrCodeProofError,
		Message: message,
		Details: details,
	}
}

// NewVerificationError creates a new verification error
func NewVerificationError(message, verificationID string) *Error {
	details := map[string]interface{}{"verification_id": verificationID}
	return &Error{
		Code:    ErrCodeVerificationError,
		Message: message,
		Details: details,
	}
}

// NewSubscriptionError creates a new subscription error
func NewSubscriptionError(message, subscriptionID string) *Error {
	details := map[string]interface{}{"subscription_id": subscriptionID}
	return &Error{
		Code:    ErrCodeSubscriptionError,
		Message: message,
		Details: details,
	}
}

// IsAPIError checks if error is an API error
func IsAPIError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeAPIError
	}
	return false
}

// IsAuthError checks if error is an authentication error
func IsAuthError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeAuthError
	}
	return false
}

// IsValidationError checks if error is a validation error
func IsValidationError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeValidationError
	}
	return false
}

// IsNetworkError checks if error is a network error
func IsNetworkError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeNetworkError
	}
	return false
}

// IsWalletError checks if error is a wallet error
func IsWalletError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeWalletError
	}
	return false
}

// IsProofError checks if error is a proof error
func IsProofError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeProofError
	}
	return false
}

// IsVerificationError checks if error is a verification error
func IsVerificationError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeVerificationError
	}
	return false
}

// IsSubscriptionError checks if error is a subscription error
func IsSubscriptionError(err error) bool {
	if verr, ok := err.(*Error); ok {
		return verr.Code == ErrCodeSubscriptionError
	}
	return false
}
