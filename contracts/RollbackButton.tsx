import React from 'react';

interface Props {
    onRollback: () => void;
    disabled?: boolean;
}

const RollbackButton: React.FC<Props> = ({ onRollback, disabled }) => {
    return (
        <button
            onClick={() => {
                if (window.confirm('Are you sure you want to rollback to this version? This will create a new version.')) {
                    onRollback();
                }
            }}
            disabled={disabled}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
        >
            Rollback to this Version
        </button>
    );
};

export default RollbackButton;