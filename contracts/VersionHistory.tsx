import React from 'react';

interface Version {
    versionNumber: number;
    timestamp: string;
    author: string;
    commitMessage: string;
    branch?: string;
}

interface Props {
    history: Version[];
    onSelectVersion: (version: number) => void;
}

const VersionHistory: React.FC<Props> = ({ history, onSelectVersion }) => {
    return (
        <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Version History</h3>
            <div className="flow-root">
                <ul className="-mb-8">
                    {history.map((version, versionIdx) => (
                        <li key={version.versionNumber}>
                            <div className="relative pb-8">
                                {versionIdx !== history.length - 1 ? (
                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                                            <span className="text-white text-xs">{version.versionNumber}</span>
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                {version.commitMessage} <span className="font-medium text-gray-900">by {version.author}</span>
                                                {version.branch && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                                        {version.branch}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                            <time dateTime={version.timestamp}>{new Date(version.timestamp).toLocaleDateString()}</time>
                                            <button 
                                                onClick={() => onSelectVersion(version.versionNumber)}
                                                className="ml-4 text-blue-600 hover:text-blue-900"
                                            >
                                                View
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default VersionHistory;