"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { Users, Plus, Edit2, Trash2, Save, X, Mail, Shield, Calendar, Search, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { createUser, deleteUser, editUser } from "@/actions/admin/users";
import type { users } from '@prisma/client'

// Error/Success notification component
const Notification = ({ 
  type, 
  message, 
  onClose 
}: { 
  type: 'error' | 'success' | 'info'; 
  message: string; 
  onClose: () => void 
}) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    error: <XCircle className="w-5 h-5 text-red-500" />,
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    info: <AlertCircle className="w-5 h-5 text-blue-500" />
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border shadow-lg ${styles[type]} animate-in slide-in-from-top duration-300`}>
      <div className="flex items-start gap-3">
        {icons[type]}
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Error display component for inline errors
const ErrorDisplay = ({ error }: { error: string }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <p className="text-sm font-medium text-red-800">Error</p>
    </div>
    <p className="text-sm text-red-700 mt-1">{error}</p>
  </div>
);

export default function UsersPage() {
  const [users, setUsers] = useState<users[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<users[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<users["role"]>("USER");
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Error and notification states
  const [notification, setNotification] = useState<{
    type: 'error' | 'success' | 'info';
    message: string;
  } | null>(null);
  const [fetchError, setFetchError] = useState<string>("");
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  // Clear form errors function
  const clearFormErrors = () => {
    setFormErrors({});
  };

  // Show notification
  const showNotification = (type: 'error' | 'success' | 'info', message: string) => {
    setNotification({ type, message });
  };

  // Clear notification
  const clearNotification = () => {
    setNotification(null);
  };

  // Fetch users with error handling
  const fetchUsers = useCallback(async () => {
    try {
      setFetchError("");
      const res = await fetch("/api/admin/users");
      
      if (!res.ok) {
        throw new Error(`Failed to fetch users: ${res.status} ${res.statusText}`);
      }
      
      const userData = await res.json();
      setUsers(userData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch users";
      setFetchError(errorMessage);
      showNotification('error', errorMessage);
      console.error("Failed to fetch users:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter users based on search query
  useEffect(() => {
    const filtered = users.filter(user =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [users, searchQuery]);

  // Validate form data
  const validateUserForm = (email: string, password: string) => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!password.trim()) {
      errors.password = "Password is required";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters long";
    }

    return errors;
  };

  // Create user with enhanced error handling
  const handleCreateUser = async (formData: FormData) => {
    startTransition(async () => {
      try {
        clearFormErrors();
        
        const email = formData.get("email") as string;
        const role = formData.get("role") as users["role"];
        const password = formData.get("password") as string;

        // Client-side validation
        const validationErrors = validateUserForm(email, password);
        if (Object.keys(validationErrors).length > 0) {
          setFormErrors(validationErrors);
          return;
        }

        const res = await createUser(email, role, password);
        
        if (res.success && res.user) {
          setUsers((prev) => [res.user, ...prev]);
          setShowAddForm(false);
          showNotification('success', `User ${email} created successfully`);
          // Reset form by fetching fresh data to ensure consistency
          await fetchUsers();
        } else {
          const errorMessage = res.message as string|| "Failed to add user";
          setFormErrors({ general: errorMessage });
          showNotification('error', errorMessage);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to add user";
        setFormErrors({ general: errorMessage });
        showNotification('error', errorMessage);
        console.error("Error creating user:", error);
      }
    });
  };

  // Edit user with enhanced error handling
  const handleEdit = (user: users) => {
    setEditingUserId(user.id);
    setEditEmail(user.email);
    setEditRole(user.role);
    clearFormErrors(); // Clear any previous errors
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;
    
    startTransition(async () => {
      try {
        clearFormErrors();

        // Client-side validation for email
        if (!editEmail.trim()) {
          setFormErrors({ email: "Email is required" });
          return;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
          setFormErrors({ email: "Please enter a valid email address" });
          return;
        }

        const res = await editUser(editingUserId, editEmail, editRole);
        
        if (res.success) {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === editingUserId ? { ...u, email: editEmail, role: editRole } : u
            )
          );
          setEditingUserId(null);
          showNotification('success', `User ${editEmail} updated successfully`);
          // Refresh to ensure consistency
          await fetchUsers();
        } else {
          const errorMessage = res.message as string || "Failed to edit user";
          setFormErrors({ general: errorMessage });
          showNotification('error', errorMessage);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to edit user";
        setFormErrors({ general: errorMessage });
        showNotification('error', errorMessage);
        console.error("Error editing user:", error);
      }
    });
  };

  // Delete user with enhanced error handling
  const handleDelete = async (id: number, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`)) return;
    
    setDeleteLoadingId(id);
    try {
      const res = await deleteUser(id);
      if (res.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        showNotification('success', `User ${userEmail} deleted successfully`);
        // Refresh to ensure consistency
        await fetchUsers();
      } else {
        const errorMessage = res.message as string || "Failed to delete user";
        showNotification('error', errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete user";
      showNotification('error', errorMessage);
      console.error("Error deleting user:", error);
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Notification */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={clearNotification}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          </div>
          <p className="text-gray-600">Manage user accounts and permissions for your application</p>
        </div>

        {/* Global Error Display */}
        {fetchError && <ErrorDisplay error={fetchError} />}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Admins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'ADMIN').length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Regular Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter(u => u.role === 'USER').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-950"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Add User Button */}
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                clearFormErrors(); // Clear errors when opening form
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="w-5 h-5 text-white" />
                  <h2 className="text-lg font-semibold text-white">Add New User</h2>
                </div>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    clearFormErrors();
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Form Errors */}
              {formErrors.general && <ErrorDisplay error={formErrors.general} />}
              
              <form action={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="user@example.com"
                      className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-950 ${
                        formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      required
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {formErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="role" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Shield className="w-4 h-4" />
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-950"
                      defaultValue="USER"
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-gray-950 ${
                        formErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-200'
                      }`}
                      required
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {formErrors.password}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isPending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {isPending ? "Adding..." : "Add User"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      clearFormErrors();
                    }}
                    className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
            <p className="text-sm text-gray-600">
              Showing {filteredUsers.length} of {users.length} users
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                          <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-lg font-medium text-gray-900 mb-1">
                          {searchQuery ? 'No users found' : 'No users yet'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {searchQuery
                            ? `No users match "${searchQuery}"`
                            : 'Start by adding your first user'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className={`hover:bg-blue-50 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        }`}
                    >
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <div>
                            <input
                              type="email"
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200'
                              }`}
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                            />
                            {formErrors.email && (
                              <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {formErrors.email}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {user.email.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.email}</div>
                              <div className="text-xs text-gray-500">ID: {user.id}</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <select
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as 'USER' | 'ADMIN')}
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${user.role === 'ADMIN'
                                ? 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800'
                                : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800'
                              }`}
                          >
                            {user.role === 'ADMIN' ? (
                              <Shield className="w-3 h-3" />
                            ) : (
                              <Users className="w-3 h-3" />
                            )}
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingUserId === user.id ? (
                          <div>
                            {formErrors.general && (
                              <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {formErrors.general}
                              </p>
                            )}
                            <form onSubmit={handleEditSubmit} className="flex gap-2">
                              <button
                                type="submit"
                                disabled={isPending}
                                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
                              >
                                <Save className="w-3 h-3" />
                                {isPending ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserId(null);
                                  clearFormErrors();
                                }}
                                className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-all"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-lg hover:bg-blue-200 transition-all transform hover:scale-105"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(user.id, user.email)}
                              disabled={deleteLoadingId === user.id}
                              className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-800 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-all transform hover:scale-105"
                            >
                              {deleteLoadingId === user.id ? (
                                <div className="w-3 h-3 border border-red-800 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              {deleteLoadingId === user.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}