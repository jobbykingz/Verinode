import React from 'react';

const Billing: React.FC = () => {
    return (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Billing & Usage</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Current Plan: Growth</h3>
                    <p className="text-gray-500 mt-1">$299/month</p>
                    <div className="mt-4">
                        <div className="flex justify-between text-sm font-medium text-gray-900">
                            <span>Storage (4.5GB / 10GB)</span>
                            <span>45%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-sm font-medium text-gray-900">
                            <span>API Calls (15.4k / 50k)</span>
                            <span>31%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: '31%' }}></div>
                        </div>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Invoices</h3>
                    <ul className="divide-y divide-gray-200">
                        <li className="py-3 flex justify-between">
                            <span className="text-sm text-gray-600">Oct 01, 2023</span>
                            <span className="text-sm font-medium text-gray-900">$299.00 <span className="text-green-600 ml-2">Paid</span></span>
                        </li>
                        <li className="py-3 flex justify-between">
                            <span className="text-sm text-gray-600">Sep 01, 2023</span>
                            <span className="text-sm font-medium text-gray-900">$299.00 <span className="text-green-600 ml-2">Paid</span></span>
                        </li>
                    </ul>
                    <button className="mt-4 text-sm text-indigo-600 hover:text-indigo-900">View all invoices</button>
                </div>
            </div>
        </div>
    );
};

export default Billing;