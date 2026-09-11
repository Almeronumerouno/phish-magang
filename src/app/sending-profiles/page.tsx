"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Edit, Trash2 } from "lucide-react";

interface Profile {
  id: number;
  name: string;
  host: string;
  fromAddress: string;
}

export default function SendingProfilesPage() {
  const [showForm, setShowForm] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch("/api/sending-profiles");
        if (res.ok) {
          const data = await res.json();
          setProfiles(data);
        }
      } catch (error) {
        console.error("Failed to fetch sending profiles:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfiles();
  }, []);

  return (
    <div className="space-y-6 max-w-[1440px] pb-6">
      <PageHeader
        title="Sending Profiles"
        description="Configure SMTP sending profiles for phishing campaigns."
        actionLabel={showForm ? "Close Form" : "Create Profile"}
        onAction={() => setShowForm(!showForm)}
      />

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Profile Form */}
          <div className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Profile Details
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  Profile Name
                </label>
                <input
                  placeholder="e.g. Default Mailer"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  SMTP Host
                </label>
                <input
                  placeholder="smtp.example.com"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  From Address
                </label>
                <input
                  placeholder="noreply@example.com"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <div className="flex gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  className="flex-1 sm:flex-none px-4 py-2 bg-btn-primary text-btn-primary-text text-xs font-medium rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Save Profile
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Test Connection */}
          <div className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">
              Test Connection
            </h3>
            <p className="text-xs text-body">
              Send a test email to verify your SMTP configuration and ensure
              emails are delivered correctly.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  Connection Method
                </label>
                <select className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border">
                  <option>SMTP (Standard)</option>
                  <option>SMTP with TLS</option>
                  <option>SMTP with SSL</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  Username
                </label>
                <input
                  placeholder="smtp-user"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">
                  Send Test Email To
                </label>
                <input
                  placeholder="test@example.com"
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
              </div>
              <button
                type="button"
                className="w-full px-4 py-2.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors cursor-pointer"
              >
                Send Test Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profiles Repository */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-border">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">
            All Profiles Repository
          </h3>
        </div>
        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="p-8 text-center text-sm text-body">
              Loading...
            </div>
          ) : profiles.length === 0 ? (
            <div className="p-8 text-center text-sm text-body">
              No sending profiles configured.
            </div>
          ) : (
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Profile Name
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    SMTP Host
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    From Address
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr
                    key={profile.id}
                    className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 sm:px-5 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                      {profile.name}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-body font-mono text-xs whitespace-nowrap">
                      {profile.host}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                      {profile.fromAddress}
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <span className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                        Active
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                          aria-label="Edit profile"
                        >
                          <Edit size={14} className="text-muted" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                          aria-label="Delete profile"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
