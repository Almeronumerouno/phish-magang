"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  X,
  FileSpreadsheet,
  Loader2,
  Search,
  Users,
  Copy,
  Check,
  Calendar,
  Mail,
  UserPlus,
} from "lucide-react";

interface Target {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
}

interface Group {
  id: number;
  name: string;
  modifiedDate: string;
  _count?: {
    targets: number;
  };
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function parseCsv(text: string): Target[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const rows = lines.map((line) =>
    line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
  );
  const [first] = rows;
  const hasHeader =
    first[0]?.toLowerCase().includes("first") ||
    first[2]?.toLowerCase().includes("email") ||
    first[0]?.toLowerCase().includes("nama");
  const data = hasHeader ? rows.slice(1) : rows;
  return data
    .filter((cols) => cols.some((c) => c))
    .map((cols) => ({
      firstName: cols[0] || "",
      lastName: cols[1] || "",
      email: (cols[2] || cols[0] || "").trim().toLowerCase(),
      position: cols[3] || "",
    }))
    .filter((m) => m.email);
}

export default function TargetGroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedEmails, setCopiedEmails] = useState(false);

  // Inline Target Form Inputs
  const [inputFirst, setInputFirst] = useState("");
  const [inputLast, setInputLast] = useState("");
  const [inputEmail, setInputEmail] = useState("");
  const [inputPosition, setInputPosition] = useState("");

  // Delete Confirm Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Flash Banner
  const [flashMessage, setFlashMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showFlash = (text: string, type: "success" | "error" = "success") => {
    setFlashMessage({ text, type });
    setTimeout(() => setFlashMessage(null), 3500);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error("Failed to fetch groups", err);
      showFlash("Gagal memuat groups", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openNewModal = () => {
    setEditingId(null);
    setGroupName("");
    setTargets([]);
    setInputFirst("");
    setInputLast("");
    setInputEmail("");
    setInputPosition("");
    setModalSearch("");
    setModalError(null);
    setModalLoading(false);
    setCopiedEmails(false);
    setModalOpen(true);
  };

  const openEditModal = async (group: Group) => {
    setEditingId(group.id);
    setGroupName(group.name);
    setTargets([]);
    setInputFirst("");
    setInputLast("");
    setInputEmail("");
    setInputPosition("");
    setModalSearch("");
    setModalError(null);
    setModalLoading(true);
    setCopiedEmails(false);
    setModalOpen(true);

    try {
      const res = await fetch(`/api/groups/${group.id}/targets`);
      if (res.ok) {
        const data = await res.json();
        setTargets(
          data.map((t: any) => ({
            id: t.id,
            firstName: t.firstName || "",
            lastName: t.lastName || "",
            email: t.email,
            position: t.position || "",
          }))
        );
      } else {
        setTargets([]);
      }
    } catch {
      setTargets([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddInlineTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inputEmail.trim().toLowerCase();
    if (!email) {
      setModalError("Email wajib diisi.");
      return;
    }
    if (!isEmail(email)) {
      setModalError(`Format email "${email}" tidak valid.`);
      return;
    }

    setModalError(null);

    setTargets((prev) => {
      const existingIdx = prev.findIndex((t) => t.email.toLowerCase() === email);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          firstName: inputFirst.trim(),
          lastName: inputLast.trim(),
          position: inputPosition.trim(),
        };
        return updated;
      }
      return [
        ...prev,
        {
          firstName: inputFirst.trim(),
          lastName: inputLast.trim(),
          email,
          position: inputPosition.trim(),
        },
      ];
    });

    setInputFirst("");
    setInputLast("");
    setInputEmail("");
    setInputPosition("");
  };

  const handleRemoveTarget = (index: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setModalError("File CSV kosong atau tidak memiliki format target email yang valid.");
        return;
      }
      setModalError(null);

      // Merge avoiding duplicates
      setTargets((prev) => {
        const map = new Map<string, Target>();
        for (const t of prev) map.set(t.email.toLowerCase(), t);
        for (const t of parsed) map.set(t.email.toLowerCase(), t);
        return Array.from(map.values());
      });

      showFlash(`Berhasil mengimpor ${parsed.length} target dari CSV!`);
    } catch {
      setModalError("Gagal membaca file CSV.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadCsvTemplate = () => {
    const header = "First Name,Last Name,Email,Position\n";
    const sample = "Budi,Santoso,budi.santoso@example.com,Finance Staff\nDewi,Kusuma,dewi.kusuma@example.com,HR Manager\n";
    const blob = new Blob([header + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "group_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modern Differentiator: Export Group to CSV from table
  const exportGroupCsv = async (group: Group) => {
    try {
      const res = await fetch(`/api/groups/${group.id}/targets`);
      if (!res.ok) throw new Error("Gagal mengambil target");
      const list = await res.json();
      if (!list || list.length === 0) {
        showFlash(`Group "${group.name}" belum memiliki target untuk diekspor.`, "error");
        return;
      }
      const header = "First Name,Last Name,Email,Position\n";
      const rows = list
        .map((t: any) => `"${t.firstName || ""}","${t.lastName || ""}","${t.email}","${t.position || ""}"`)
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${group.name.toLowerCase().replace(/\s+/g, "_")}_targets.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showFlash(`Berhasil mengekspor ${list.length} target dari group "${group.name}"!`);
    } catch {
      showFlash("Gagal mengekspor data group", "error");
    }
  };

  // Modern Differentiator: Export current modal targets to CSV
  const exportCurrentTargetsCsv = () => {
    if (targets.length === 0) {
      setModalError("Belum ada target untuk diekspor.");
      return;
    }
    const header = "First Name,Last Name,Email,Position\n";
    const rows = targets
      .map((t) => `"${t.firstName}","${t.lastName}","${t.email}","${t.position}"`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(groupName.trim() || "targets").toLowerCase().replace(/\s+/g, "_")}_targets.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFlash(`Berhasil mengekspor ${targets.length} target!`);
  };

  // Modern Differentiator: Copy all emails to clipboard
  const copyAllEmails = () => {
    if (targets.length === 0) return;
    const emails = targets.map((t) => t.email).join(", ");
    navigator.clipboard.writeText(emails);
    setCopiedEmails(true);
    setTimeout(() => setCopiedEmails(false), 2000);
    showFlash(`Disalin ${targets.length} alamat email ke clipboard!`);
  };

  const getInitials = (t: Target) => {
    const f = t.firstName?.trim();
    const l = t.lastName?.trim();
    if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
    if (f) return f.slice(0, 2).toUpperCase();
    const namePart = t.email.split("@")[0];
    return namePart.slice(0, 2).toUpperCase() || "T";
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      setModalError("Nama group wajib diisi.");
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const payload = {
        name: groupName.trim(),
        members: targets.map((t) => ({
          ...(t.id ? { id: t.id } : {}),
          firstName: t.firstName.trim() || null,
          lastName: t.lastName.trim() || null,
          email: t.email.trim(),
          position: t.position.trim() || null,
        })),
      };

      const url = editingId ? `/api/groups/${editingId}` : "/api/groups";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Gagal menyimpan group");
      }

      setModalOpen(false);
      showFlash(editingId ? "Group updated successfully!" : "Group added successfully!");
      fetchGroups();
    } catch (err: any) {
      setModalError(err.message || "Gagal menyimpan group.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus group");
      showFlash("Group deleted successfully!");
      setDeleteConfirm(null);
      fetchGroups();
    } catch {
      showFlash("Gagal menghapus group", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTargetsAcrossGroups = groups.reduce((acc, g) => acc + (g._count?.targets ?? 0), 0);

  const filteredModalTargets = targets.filter((t) => {
    if (!modalSearch.trim()) return true;
    const q = modalSearch.toLowerCase();
    return (
      t.email.toLowerCase().includes(q) ||
      t.firstName.toLowerCase().includes(q) ||
      t.lastName.toLowerCase().includes(q) ||
      t.position.toLowerCase().includes(q)
    );
  });

  const uniqueDomains = Array.from(new Set(targets.map((t) => t.email.split("@")[1]).filter(Boolean)));

  return (
    <div className="space-y-5 max-w-[1440px] pb-10">
      {/* Modern Header with Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Users &amp; Groups
              </h1>
              <p className="text-xs text-muted">
                Create and manage target groups for phishing simulations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted bg-gray-50 border border-border px-3 py-1.5 rounded-md">
            <span className="font-semibold text-foreground">{groups.length}</span> Groups
            <span className="text-gray-300">•</span>
            <span className="font-semibold text-foreground">{totalTargetsAcrossGroups}</span> Targets Total
          </div>

          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-all shadow-xs cursor-pointer w-full sm:w-auto"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {/* Flash Alert Banner */}
      {flashMessage && (
        <div
          className={`p-3 text-xs rounded-md border flex items-center justify-between animate-in fade-in ${
            flashMessage.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <span>{flashMessage.text}</span>
          <button
            type="button"
            onClick={() => setFlashMessage(null)}
            className="text-muted hover:text-foreground p-0.5"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Main Groups Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        {/* Table Filter Bar */}
        <div className="p-3 border-b border-border bg-gray-50/50 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-muted shrink-0">
            {filteredGroups.length} {filteredGroups.length === 1 ? "group" : "groups"}
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-gray-50 font-semibold text-muted uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">Group Name</th>
                <th className="px-4 py-3"># of Members</th>
                <th className="px-4 py-3">Modified Date</th>
                <th className="px-4 py-3 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-muted">
                    <Loader2 size={24} className="animate-spin text-muted mx-auto mb-2" />
                    <span>Loading groups...</span>
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <div className="p-4 bg-blue-50/60 border border-blue-200 text-blue-900 rounded-md max-w-md mx-auto text-xs">
                      No groups created yet. Click <b>New Group</b> above to create one!
                    </div>
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No groups matching &quot;{searchQuery}&quot;
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => {
                  const count = group._count?.targets ?? 0;
                  const dateStr = new Date(group.modifiedDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                  });

                  return (
                    <tr key={group.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-100">
                            {group.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{group.name}</span>
                            <span className="text-[11px] text-muted font-mono">ID #{group.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                          <Users size={11} className="text-slate-500" />
                          <span className="font-semibold font-mono text-foreground">{count}</span>
                          <span className="text-muted text-[10px]">{count === 1 ? "member" : "members"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar size={13} className="text-muted/70 shrink-0" />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => exportGroupCsv(group)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-transparent hover:border-emerald-200 transition-colors"
                            title="Export to CSV"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(group)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-colors"
                            title="Edit Group"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(group)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors"
                            title="Delete Group"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== TARGET GROUP MODAL ===================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {editingId ? "Edit Group" : "New Group"}
                  </h3>
                  <p className="text-[11px] text-muted">
                    {editingId ? `Update settings and target recipients for this group` : "Configure recipient list and import members"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-muted hover:text-foreground p-1 rounded-md hover:bg-gray-200/50 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {modalError && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md">
                  {modalError}
                </div>
              )}

              {/* Name Input */}
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  Name:
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Finance Department, Executive Board"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Bulk Import & Actions Bar */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white font-medium rounded-md cursor-pointer transition-colors shadow-2xs text-xs">
                  <Upload size={13} />
                  <span>Bulk Import Users</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,.txt"
                    className="hidden"
                    onChange={handleCsvUpload}
                  />
                </label>

                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-white hover:bg-gray-50 text-foreground rounded-md transition-colors text-xs font-medium cursor-pointer"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" />
                  <span>Download CSV Template</span>
                </button>

                {targets.length > 0 && (
                  <button
                    type="button"
                    onClick={exportCurrentTargetsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-white hover:bg-gray-50 text-foreground rounded-md transition-colors text-xs font-medium ml-auto cursor-pointer"
                    title="Export current targets to CSV"
                  >
                    <Download size={13} className="text-blue-600" />
                    <span>Export CSV ({targets.length})</span>
                  </button>
                )}
              </div>

              {/* Inline Add Target Form */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted font-medium flex items-center gap-1">
                    <UserPlus size={12} className="text-blue-600" />
                    <span>Add Member Manually:</span>
                  </p>
                </div>

                <form
                  onSubmit={handleAddInlineTarget}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                >
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={inputFirst}
                      onChange={(e) => setInputFirst(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={inputLast}
                      onChange={(e) => setInputLast(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="email"
                      required
                      placeholder="Email *"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Position"
                      value={inputPosition}
                      onChange={(e) => setInputPosition(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="submit"
                      className="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="Add member"
                    >
                      <Plus size={14} />
                      <span className="sm:hidden">Add</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Targets Table Inside Modal */}
              <div className="border border-border rounded-md overflow-hidden bg-white shadow-2xs">
                {/* Search Filter when targets > 3 */}
                {targets.length > 3 && (
                  <div className="p-2 border-b border-border bg-gray-50/50 flex items-center justify-between gap-2">
                    <div className="relative w-full max-w-xs">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        placeholder="Filter members..."
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-[11px] text-muted shrink-0">
                      {filteredModalTargets.length} of {targets.length} members
                    </span>
                  </div>
                )}

                <div className="max-h-[280px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-border sticky top-0 font-semibold text-muted uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Member</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Position</th>
                        <th className="px-3 py-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {modalLoading ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-muted">
                            <Loader2 size={18} className="animate-spin text-muted mx-auto mb-1.5" />
                            <span>Loading targets...</span>
                          </td>
                        </tr>
                      ) : targets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-muted">
                            No targets added yet. Use the form above or bulk import via CSV.
                          </td>
                        </tr>
                      ) : filteredModalTargets.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-muted">
                            No members matching &quot;{modalSearch}&quot;
                          </td>
                        </tr>
                      ) : (
                        filteredModalTargets.map((t, idx) => {
                          const fullName = [t.firstName, t.lastName].filter(Boolean).join(" ");
                          return (
                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-3 py-2 text-foreground">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center justify-center font-bold text-[10px] shrink-0">
                                    {getInitials(t)}
                                  </div>
                                  <span className="font-medium text-foreground">
                                    {fullName || "-"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 text-blue-600 font-mono text-[11px]">
                                  <Mail size={11} className="text-slate-400 shrink-0" />
                                  <span>{t.email}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                {t.position ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                                    {t.position}
                                  </span>
                                ) : (
                                  <span className="text-muted text-[11px]">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTarget(idx)}
                                  className="text-muted hover:text-red-600 p-1 rounded transition-colors"
                                  title="Remove member"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {targets.length > 0 && (
                <div className="text-[11px] text-muted flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span>
                      Total: <b className="text-foreground">{targets.length}</b> targets
                    </span>
                    {uniqueDomains.length > 0 && (
                      <span className="text-slate-500">
                        ({uniqueDomains.length} domain{uniqueDomains.length > 1 ? "s" : ""}: @{uniqueDomains.slice(0, 2).join(", @")}{uniqueDomains.length > 2 ? "..." : ""})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={copyAllEmails}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                    >
                      {copiedEmails ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedEmails ? "Copied!" : "Copy all emails"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargets([])}
                      className="text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Clear all targets
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-gray-50/50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium border border-border bg-white rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                <span>{saving ? "Saving..." : "Save changes"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-lg w-full max-w-sm shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-foreground">
                Delete &quot;{deleteConfirm.name}&quot;?
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                This will delete the target group. All simulation configurations tied to this group may be affected.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3.5 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
