"use client";

import { useState, useEffect } from "react";
import {
  Server,
  Plus,
  Pencil,
  Copy,
  Trash2,
  Mail,
  Send,
  HelpCircle,
  X,
  Loader2,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";

interface HeaderItem {
  key: string;
  value: string;
}

interface SendingProfile {
  id: number;
  name: string;
  interface_type: string;
  from_address: string;
  host: string;
  username: string;
  password?: string;
  ignore_cert_errors: boolean;
  modified_date: string;
  headers: HeaderItem[];
}

export default function SendingProfilesPage() {
  const [profiles, setProfiles] = useState<SendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Main Modal State (New / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Profile Form Fields
  const [formName, setFormName] = useState("");
  const [formInterfaceType, setFormInterfaceType] = useState("SMTP");
  const [formFromAddress, setFormFromAddress] = useState("");
  const [formHost, setFormHost] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIgnoreCertErrors, setFormIgnoreCertErrors] = useState(true);
  const [formHeaders, setFormHeaders] = useState<HeaderItem[]>([]);

  // Email Header Inputs
  const [headerKeyInput, setHeaderKeyInput] = useState("");
  const [headerValueInput, setHeaderValueInput] = useState("");

  // Send Test Email Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testFirstName, setTestFirstName] = useState("");
  const [testLastName, setTestLastName] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testPosition, setTestPosition] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Delete Confirm Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<SendingProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Page Flash Notification
  const [flashMessage, setFlashMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showFlash = (text: string, type: "success" | "error" = "success") => {
    setFlashMessage({ text, type });
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sending-profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data);
      } else {
        showFlash("Gagal memuat profil pengiriman.", "error");
      }
    } catch (err) {
      console.error("Failed to fetch sending profiles:", err);
      showFlash("Gagal memuat profil pengiriman.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  // Open New Profile Modal
  const openNewModal = () => {
    setEditingId(null);
    setFormName("");
    setFormInterfaceType("SMTP");
    setFormFromAddress("");
    setFormHost("");
    setFormUsername("");
    setFormPassword("");
    setFormIgnoreCertErrors(true);
    setFormHeaders([]);
    setHeaderKeyInput("");
    setHeaderValueInput("");
    setModalError(null);
    setModalOpen(true);
  };

  // Open Edit Profile Modal
  const openEditModal = (profile: SendingProfile) => {
    setEditingId(profile.id);
    setFormName(profile.name);
    setFormInterfaceType(profile.interface_type || "SMTP");
    setFormFromAddress(profile.from_address || "");
    setFormHost(profile.host || "");
    setFormUsername(profile.username || "");
    setFormPassword(profile.password || "");
    setFormIgnoreCertErrors(Boolean(profile.ignore_cert_errors));
    setFormHeaders(profile.headers ? [...profile.headers] : []);
    setHeaderKeyInput("");
    setHeaderValueInput("");
    setModalError(null);
    setModalOpen(true);
  };

  // Copy Profile (GoPhish copy logic)
  const copyProfile = (profile: SendingProfile) => {
    setEditingId(null); // save as new profile
    setFormName(`Copy of ${profile.name}`);
    setFormInterfaceType(profile.interface_type || "SMTP");
    setFormFromAddress(profile.from_address || "");
    setFormHost(profile.host || "");
    setFormUsername(profile.username || "");
    setFormPassword(profile.password || "");
    setFormIgnoreCertErrors(Boolean(profile.ignore_cert_errors));
    setFormHeaders(profile.headers ? [...profile.headers] : []);
    setHeaderKeyInput("");
    setHeaderValueInput("");
    setModalError(null);
    setModalOpen(true);
  };

  // Custom Header Addition (duplicate keys update existing row)
  const handleAddCustomHeader = () => {
    const key = headerKeyInput.trim();
    const value = headerValueInput.trim();
    if (!key || !value) return;

    setFormHeaders((prev) => {
      const idx = prev.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { key, value };
        return updated;
      }
      return [...prev, { key, value }];
    });

    setHeaderKeyInput("");
    setHeaderValueInput("");
  };

  const handleRemoveHeader = (index: number) => {
    setFormHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Profile (POST or PUT)
  const handleSaveProfile = async () => {
    if (!formName.trim()) {
      setModalError("Nama profil wajib diisi.");
      return;
    }
    if (!formFromAddress.trim()) {
      setModalError("SMTP From address wajib diisi.");
      return;
    }
    if (!formHost.trim()) {
      setModalError("SMTP Host wajib diisi.");
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      const payload = {
        name: formName.trim(),
        interface_type: formInterfaceType,
        from_address: formFromAddress.trim(),
        host: formHost.trim(),
        username: formUsername.trim(),
        password: formPassword,
        ignore_cert_errors: formIgnoreCertErrors,
        headers: formHeaders,
      };

      const url = editingId ? `/api/sending-profiles/${editingId}` : "/api/sending-profiles";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Gagal menyimpan sending profile");
      }

      setModalOpen(false);
      showFlash(editingId ? "Profil berhasil diperbarui!" : "Profil berhasil ditambahkan!");
      fetchProfiles();
    } catch (err: any) {
      setModalError(err.message || "Gagal menyimpan sending profile.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Profile
  const handleDeleteProfile = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sending-profiles/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal menghapus sending profile");

      showFlash("Profil pengiriman berhasil dihapus!");
      setDeleteConfirm(null);
      fetchProfiles();
    } catch (err: any) {
      showFlash(err.message || "Gagal menghapus sending profile", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Send Test Email Flow
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      setTestFeedback({ type: "error", message: "Email penerima wajib diisi" });
      return;
    }

    setSendingTest(true);
    setTestFeedback(null);

    try {
      const payload = {
        first_name: testFirstName.trim(),
        last_name: testLastName.trim(),
        email: testEmail.trim(),
        position: testPosition.trim(),
        smtp: {
          from_address: formFromAddress.trim(),
          host: formHost.trim(),
          username: formUsername.trim(),
          password: formPassword,
          ignore_cert_errors: formIgnoreCertErrors,
          headers: formHeaders,
        },
      };

      const res = await fetch("/api/sending-profiles/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Gagal mengirim test email");
      }

      setTestFeedback({ type: "success", message: "Email tes berhasil dikirim!" });
    } catch (err: any) {
      setTestFeedback({
        type: "error",
        message: err.message || "Gagal mengirim test email",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const filteredProfiles = profiles.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.from_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-[1440px] pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Server size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Sending Profiles
              </h1>
              <p className="text-xs text-muted">
                Konfigurasi profil pengiriman SMTP untuk simulasi phishing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted bg-gray-50 border border-border px-3 py-1.5 rounded-md">
            <span className="font-semibold text-foreground">{profiles.length}</span> Profiles Configured
          </div>

          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-all shadow-xs cursor-pointer w-full sm:w-auto"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Profile</span>
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
          <div className="flex items-center gap-2">
            {flashMessage.type === "success" ? (
              <CheckCircle2 size={15} className="text-green-600" />
            ) : (
              <AlertCircle size={15} className="text-red-600" />
            )}
            <span>{flashMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFlashMessage(null)}
            className="text-muted hover:text-foreground p-0.5"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Main Profiles Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        {/* Table Filter Bar */}
        <div className="p-3 border-b border-border bg-gray-50/50 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search profiles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-muted shrink-0">
            {filteredProfiles.length} {filteredProfiles.length === 1 ? "profile" : "profiles"}
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-gray-50 font-semibold text-muted uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Interface Type</th>
                <th className="px-4 py-3">From Address</th>
                <th className="px-4 py-3">Host</th>
                <th className="px-4 py-3">Last Modified Date</th>
                <th className="px-4 py-3 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    <Loader2 size={24} className="animate-spin text-muted mx-auto mb-2" />
                    <span>Loading profiles...</span>
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <div className="p-4 bg-blue-50/60 border border-blue-200 text-blue-900 rounded-md max-w-md mx-auto text-xs">
                      Belum ada sending profile yang dibuat. Klik <b>New Profile</b> di atas untuk membuat profil baru!
                    </div>
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Tidak ada profil yang sesuai dengan &quot;{searchQuery}&quot;
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const dateStr = new Date(profile.modified_date).toLocaleDateString("id-ID", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "numeric",
                  });

                  return (
                    <tr key={profile.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-100">
                            {profile.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{profile.name}</span>
                            <span className="text-[11px] text-muted font-mono">ID #{profile.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {profile.interface_type || "SMTP"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                        {profile.from_address}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted">
                        {profile.host}
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
                            onClick={() => openEditModal(profile)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                            title="Edit Profile"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => copyProfile(profile)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                            title="Copy Profile"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(profile)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                            title="Delete Profile"
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

      {/* ===================== NEW / EDIT PROFILE MODAL ===================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                  <Server size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {editingId ? "Edit Sending Profile" : "New Sending Profile"}
                  </h3>
                  <p className="text-[11px] text-muted">
                    {editingId
                      ? `Perbarui konfigurasi profil pengiriman #${editingId}`
                      : "Konfigurasi kredensial SMTP baru untuk pengiriman email simulasi"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-muted hover:text-foreground p-1 rounded-md hover:bg-gray-200/50 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {modalError && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Form inputs */}
              <div className="space-y-3">
                {/* Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    Name:
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Profile name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Interface Type (Disabled SMTP) */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    Interface Type:
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formInterfaceType}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-gray-100 text-muted font-mono cursor-not-allowed"
                  />
                </div>

                {/* SMTP From */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="font-semibold text-foreground block">
                      SMTP From:
                    </label>
                    <div
                      className="group relative cursor-pointer text-muted hover:text-blue-600"
                      title="Gunakan alamat email dari domain pengirim Anda untuk melewati pemeriksaan SPF. Anda dapat mengatur Envelope Sender di Email Templates (Envelope Sender inilah yang akan ditampilkan ke target penerima)."
                    >
                      <HelpCircle size={13} />
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="First Last <test@example.com>"
                    value={formFromAddress}
                    onChange={(e) => setFormFromAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-muted leading-tight">
                    Format: <code>user@example.com</code> atau <code>First Last &lt;user@example.com&gt;</code>
                  </p>
                </div>

                {/* Host */}
                <div className="space-y-1">
                  <label className="font-semibold text-foreground block">
                    Host:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="smtp.example.com:25"
                    value={formHost}
                    onChange={(e) => setFormHost(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-muted leading-tight">
                    Jika port tidak dicantumkan, sistem otomatis menggunakan default port <code>25</code> (atau gunakan <code>587</code> untuk TLS / <code>465</code> untuk SSL).
                  </p>
                </div>

                {/* Username & Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground block">
                      Username:
                    </label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground block">
                      Password:
                    </label>
                    <input
                      type="password"
                      placeholder="Password"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Ignore Certificate Errors */}
                <div className="pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formIgnoreCertErrors}
                      onChange={(e) => setFormIgnoreCertErrors(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 border-border focus:ring-blue-500"
                    />
                    <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      Ignore Certificate Errors
                      <span
                        className="text-muted hover:text-blue-600 cursor-pointer"
                        title="Abaikan error sertifikat umum seperti self-signed certs (berisiko terhadap serangan Man-in-the-Middle / MiTM - gunakan dengan hati-hati!)"
                      >
                        <HelpCircle size={13} />
                      </span>
                    </span>
                  </label>
                </div>

                {/* Email Headers Section (GoPhish Style) */}
                <div className="pt-3 border-t border-border space-y-2.5">
                  <label className="font-semibold text-foreground block text-xs">
                    Email Headers:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="X-Custom-Header"
                        value={headerKeyInput}
                        onChange={(e) => setHeaderKeyInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="{{.URL}}-gophish"
                        value={headerValueInput}
                        onChange={(e) => setHeaderValueInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddCustomHeader}
                        className="w-full py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Headers Table */}
                  <div className="border border-border rounded-md overflow-hidden bg-white shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b border-border font-semibold text-muted uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="px-3 py-2 w-5/12">Header</th>
                          <th className="px-3 py-2 w-6/12">Value</th>
                          <th className="px-3 py-2 w-1/12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {formHeaders.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-muted text-[11px]">
                              Belum ada custom email headers yang ditambahkan.
                            </td>
                          </tr>
                        ) : (
                          formHeaders.map((header, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-3 py-1.5 font-mono text-[11px] text-foreground font-semibold">
                                {header.key}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-[11px] text-body">
                                {header.value}
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveHeader(idx)}
                                  className="text-muted hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                                  title="Remove header"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Send Test Email Trigger Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTestFeedback(null);
                      setTestModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors shadow-2xs text-xs cursor-pointer"
                  >
                    <Mail size={13} />
                    <span>Send Test Email</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-gray-50/50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium border border-border bg-white rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                <span>{saving ? "Saving..." : "Save Profile"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== SEND TEST EMAIL MODAL (Child Modal) ===================== */}
      {testModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-lg w-full max-w-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gray-50/70">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                  <Mail size={16} />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  Send Test Email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-muted hover:text-foreground p-1 rounded-md hover:bg-gray-200/50 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSendTestEmail}>
              <div className="p-5 space-y-4 text-xs">
                {/* Feedback Alert */}
                {testFeedback && (
                  <div
                    className={`p-3 text-xs rounded-md border flex items-center gap-2 ${
                      testFeedback.type === "success"
                        ? "bg-green-50 text-green-800 border-green-200"
                        : "bg-red-50 text-red-800 border-red-200"
                    }`}
                  >
                    {testFeedback.type === "success" ? (
                      <CheckCircle2 size={15} className="text-green-600 shrink-0" />
                    ) : (
                      <AlertCircle size={15} className="text-red-600 shrink-0" />
                    )}
                    <span>{testFeedback.message}</span>
                  </div>
                )}

                <p className="font-semibold text-foreground">
                  Send Test Email to:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={testFirstName}
                      onChange={(e) => setTestFirstName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={testLastName}
                      onChange={(e) => setTestLastName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="email"
                      required
                      placeholder="Email *"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-mono"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Position"
                      value={testPosition}
                      onChange={(e) => setTestPosition(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-md text-[11px] text-blue-900 leading-relaxed">
                  Test email akan dikirim menggunakan kredensial host <code>{formHost || "smtp.example.com"}</code> dan pengirim <code>{formFromAddress || "noreply"}</code> yang sedang dikonfigurasi pada form di atas.
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-border bg-white rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {sendingTest ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>{sendingTest ? "Sending..." : "Send"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-lg w-full max-w-sm shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                <ShieldAlert size={18} />
                <span>Are you sure?</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Profil pengiriman &quot;<b>{deleteConfirm.name}</b>&quot; akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan!
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
                onClick={handleDeleteProfile}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : `Delete ${deleteConfirm.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
