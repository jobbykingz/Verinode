import React, { useState } from 'react';

const BulkOperations: React.FC = () => {
    const [selectedItems, setSelectedItems] = useState<number[]>([]);
    
    // Mock data
    const proofs = [
        { id: 1, name: 'Contract v1.pdf', status: 'Verified', date: '2023-10-20' },
        { id: 2, name: 'Invoice #992.pdf', status: 'Pending', date: '2023-10-21' },
        { id: 3, name: 'Agreement.docx', status: 'Verified', date: '2023-10-22' },
    ];

    const toggleSelection = (id: number) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(item => item !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const toggleSelectAll = () => {
        if (selectedItems.length === proofs.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(proofs.map(p => p.id));
        }
    };

    const handleBulkAction = (action: string) => {
        alert(`Performing ${action} on ${selectedItems.length} items`);
        setSelectedItems([]);
    };

    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Bulk Operations</h2>
                <div className="space-x-2">
                    <button 
                        disabled={selectedItems.length === 0}
                        onClick={() => handleBulkAction('Verify')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                        Verify Selected
                    </button>
                    <button 
                        disabled={selectedItems.length === 0}
                        onClick={() => handleBulkAction('Archive')}
                        className="bg-gray-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                        Archive Selected
                    </button>
                </div>
            </div>
            <ul className="divide-y divide-gray-200">
                <div className="py-3 border-b border-gray-200 flex items-center px-4 bg-gray-50">
                    <input
                        type="checkbox"
                        checked={selectedItems.length === proofs.length && proofs.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-4"
                    />
                    <span className="text-sm text-gray-500 font-medium">Select All ({proofs.length} items)</span>
                </div>
                {proofs.map((proof) => (
                    <li key={proof.id} className="py-4 flex items-center">
                        <input 
                            type="checkbox" 
                            checked={selectedItems.includes(proof.id)}
                            onChange={() => toggleSelection(proof.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-4"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{proof.name}</p>
                            <p className="text-sm text-gray-500">{proof.date} • {proof.status}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default BulkOperations;