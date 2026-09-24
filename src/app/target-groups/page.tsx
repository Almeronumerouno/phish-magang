"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Upload, UserPlus, Trash2, Edit } from "lucide-react";

interface Target {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  department: string | null;
  position: string | null;
}

interface Group {
  id: number;
  name: string;
  modifiedDate: string;
  _count?: {
    targets: number;
  };
}

export default function TargetGroupsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"groups" | "import">("groups");
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // New state for the Quick Add Target form
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
  });

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (error) {
      console.error("Failed to fetch groups", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleGroupClick = async (group: Group) => {
    setSelectedGroup(group);
    setLoadingTargets(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/targets`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data);
      } else {
        setTargets([]);
      }
    } catch (error) {
      console.error("Failed to fetch targets", error);
      setTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  };

  // Handler for adding a new target to the database
  const handleAddTarget = async () => {
    if (!formData.email) {
      alert("Email is required");
      return;
    }

    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to save target");
      }

      const newEntry = await res.json();

      // Refresh the groups list from the database
      await fetchGroups();

      // Automatically select the newly updated or created group to preview it
      if (newEntry.group) {
        handleGroupClick(newEntry.group);
      }

      // Reset form
      setFormData({ firstName: "", lastName: "", email: "", department: "" });
      setShowAddForm(false);
    } catch (error) {
      console.error("Error adding target:", error);
      alert("Failed to add target to database.");
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] pb-6">
      <PageHeader
        title="Target Groups"
        description="Create and manage target groups for phishing simulations."
        actionLabel={showAddForm ? "Close Form" : "Add Group"}
        onAction={() => setShowAddForm(!showAddForm)}
      />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("groups")}
          className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "groups"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Groups
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("import")}
          className={`pb-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "import"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Bulk Import
        </button>
      </div>

      {activeTab === "import" && (
        <div className="bg-card rounded-lg border border-border p-4 sm:p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Bulk Import Targets
          </h3>
          <p className="text-xs text-body">
            Upload a CSV file with target recipients to add them to a group.
          </p>
          <div className="border-2 border-dashed border-border rounded-lg p-6 sm:p-8 flex flex-col items-center gap-3 text-center">
            <Upload size={24} className="text-muted" />
            <p className="text-xs sm:text-sm text-muted">
              Drag and drop your CSV file here, or browse from device
            </p>
            <button
              type="button"
              className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Browse Files
            </button>
          </div>
        </div>
      )}

      {activeTab === "groups" && (
        <>
          {/* Quick Add Target */}
          {showAddForm && (
            <div className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Quick Add Target
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <input
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
                <input
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
                <input
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
                <input
                  placeholder="Department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-border"
                />
                <button
                  type="button"
                  onClick={handleAddTarget}
                  className="col-span-1 sm:col-span-2 lg:col-span-1 px-4 py-2 bg-black text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  Add Target
                </button>
              </div>
            </div>
          )}

          {/* Groups Table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Group Name
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Members
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Last Modified
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingGroups && groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : groups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
                        No groups yet.
                      </td>
                    </tr>
                  ) : (
                    groups.map((group) => (
                      <tr
                        key={group.id}
                        onClick={() => handleGroupClick(group)}
                        className={`border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                          selectedGroup?.id === group.id ? "bg-gray-50" : ""
                        }`}
                      >
                        <td className="px-4 sm:px-5 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                          &gt; {group.name}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                          {group._count?.targets || 0}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                          {new Date(group.modifiedDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                              aria-label="Edit group"
                            >
                              <Edit size={14} className="text-muted" />
                            </button>
                            <button
                              type="button"
                              className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                              aria-label="Delete group"
                            >
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Members Preview */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-border flex justify-between items-center">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                {selectedGroup
                  ? `Group Members Preview: ${selectedGroup.name}`
                  : "Group Members Preview"}
              </h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Email
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Department
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Position
                    </th>
                    <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedGroup ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                        Select a group to view its members.
                      </td>
                    </tr>
                  ) : loadingTargets && targets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                        Loading...
                      </td>
                    </tr>
                  ) : targets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                        No members in this group.
                      </td>
                    </tr>
                  ) : (
                    targets.map((target) => (
                      <tr
                        key={target.id}
                        className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-5 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                          {target.firstName || ""} {target.lastName || ""}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-sm text-blue-600 whitespace-nowrap">
                          {target.email}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                          {target.department || "-"}
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                          {target.position || "-"}
                        </td>
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                              aria-label="Edit member"
                            >
                              <Edit size={14} className="text-muted" />
                            </button>
                            <button
                              type="button"
                              className="p-1 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                              aria-label="Delete member"
                            >
                              <Trash2 size={14} className="text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}