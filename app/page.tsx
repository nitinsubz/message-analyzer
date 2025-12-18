'use client';

import { useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface Contact {
  id: number;
  phoneNumber: string;
  contactName: string | null;
  messageCount: number;
  receivedCount: number;
  sentCount: number;
}

interface DailyStat {
  day: string;
  count: number;
}

interface HourlyStat {
  hour: number;
  count: number;
}

interface AnalysisResult {
  summary: {
    totalMessages: number;
    sentMessages: number;
    receivedMessages: number;
    uniqueContacts: number;
  };
  contacts: Contact[];
  dailyStats: DailyStat[];
  hourlyStats: HourlyStat[];
  messages: any[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [contactsFile, setContactsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contactsInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setData(null);
    }
  };

  const handleContactsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setContactsFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (contactsFile) {
        formData.append('contactsFile', contactsFile);
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze file');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the file');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setData(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            💬 Chat Analyzer
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Upload your macOS Messages chat.db file to get detailed statistics
          </p>
        </div>

        {/* File Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="space-y-4">
              <div className="text-6xl">📁</div>
              {file ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    Drag and drop your chat.db file here
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    or click to browse
                  </p>
                </div>
              )}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {file ? 'Change File' : 'Select File'}
                </button>
                {file && (
                  <button
                    onClick={handleUpload}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Analyzing...' : 'Analyze'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold mb-2">Where to find your chat.db file:</p>
            <code className="block bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs mb-4">
              ~/Library/Messages/chat.db
            </code>
            
            {/* Contacts File Upload */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="font-semibold mb-2">Optional: Upload Contacts (vCard format)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Upload a .vcf file to match phone numbers to contact names
              </p>
              <input
                ref={contactsInputRef}
                type="file"
                accept=".vcf,.vcard"
                onChange={handleContactsFileChange}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => contactsInputRef.current?.click()}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  {contactsFile ? 'Change Contacts' : 'Select Contacts File'}
                </button>
                {contactsFile && (
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {contactsFile.name}
                  </span>
                )}
                {contactsFile && (
                  <button
                    onClick={() => {
                      setContactsFile(null);
                      if (contactsInputRef.current) {
                        contactsInputRef.current.value = '';
                      }
                    }}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                To export contacts from macOS: Contacts app → Select All → File → Export → Export vCard
              </p>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {data && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {data.summary.totalMessages.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Total Messages
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {data.summary.sentMessages.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Sent Messages
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {data.summary.receivedMessages.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Received Messages
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {data.summary.uniqueContacts.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Unique Contacts
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Message Activity */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Daily Message Activity (Last 365 Days)
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.dailyStats.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Hourly Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Message Distribution by Hour
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.hourlyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Contacts */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Top Contacts
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-700 dark:text-gray-300">Contact</th>
                      <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Total</th>
                      <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Sent</th>
                      <th className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.contacts.slice(0, 20).map((contact) => (
                      <tr
                        key={contact.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          <div>
                            {contact.contactName ? (
                              <>
                                <div className="font-semibold">{contact.contactName}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {contact.phoneNumber || 'Unknown'}
                                </div>
                              </>
                            ) : (
                              contact.phoneNumber || 'Unknown'
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                          {contact.messageCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">
                          {contact.sentCount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-purple-600 dark:text-purple-400">
                          {contact.receivedCount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
