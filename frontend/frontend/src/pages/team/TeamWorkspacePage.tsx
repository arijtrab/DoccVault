import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Users, FileLock2, UserMinus, Share2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDocuments } from '../../context/DocumentContext';
import { formatBytes } from '../../utils/formatters';

type TeamMember = { id: string; name: string; email: string; team_id?: string };
type TeamSummary = { id: string; name: string; manager_id: string; member_count: number };
type TeamShare = { documentId: string; userId: string; memberName: string; role: 'viewer' | 'editor'; status: string; title: string; originalFileName: string; sensitivity: string; ownerName: string };
type ShareRequest = { id: string; documentId: string; requesterId: string; requesterName: string; requestedRole: 'viewer' | 'editor'; status: string; title: string; ownerName: string };
type AvailableMember = { id: string; name: string; email: string };

async function teamRequest(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('docvault_auth_token');
  const response = await fetch(`/api/v1/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Team request failed.');
  return body;
}

export const TeamWorkspacePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { documents, addToast, refreshDocuments } = useDocuments();
  const canManageTeams = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const [teamName, setTeamName] = useState('');
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamId, setTeamId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [shares, setShares] = useState<TeamShare[]>([]);
  const [shareRequests, setShareRequests] = useState<ShareRequest[]>([]);
  const [roles, setRoles] = useState<Record<string, 'viewer' | 'editor'>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const teamDocuments = useMemo(() => {
    const memberIds = new Set(members.map(member => member.id));
    const sharedIds = new Set(shares.map(share => share.documentId));
    return documents.filter(doc => memberIds.has(doc.ownerId) || sharedIds.has(doc.id));
  }, [documents, members, shares]);
  useEffect(() => {
    teamRequest('/teams').then((items: TeamSummary[]) => {
      setTeams(items);
      setTeamId(previous => items.some(team => team.id === previous) ? previous : items[0]?.id || '');
    }).catch(requestError => setError(requestError instanceof Error ? requestError.message : 'Unable to load your teams.'));
  }, [currentUser?.id, currentUser?.role]);
  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const [teamMembers, candidates, teamData] = await Promise.all([
        teamRequest(`/teams/${encodeURIComponent(teamId)}/members`),
        canManageTeams ? teamRequest(`/teams/${encodeURIComponent(teamId)}/available-members`) : Promise.resolve([]),
        teamRequest(`/teams/${encodeURIComponent(teamId)}/document-shares`),
      ]);
      setMembers(teamMembers);
      setAvailableMembers(candidates);
      setShares(teamData.shares);
      setShareRequests(teamData.requests);
      setRoles(Object.fromEntries(teamData.shares.map((share: TeamShare) => [`${share.documentId}:${share.userId}`, share.role])));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load the team.');
    } finally {
      setLoading(false);
    }
  }, [teamId, canManageTeams]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const created = await teamRequest('/teams', { method: 'POST', body: JSON.stringify({ name: teamName }) });
      setTeams(previous => [...previous, { ...created, manager_id: created.managerId, member_count: created.memberCount }]);
      setTeamId(created.id);
      setTeamName('');
      addToast('success', 'Team Created', `${created.name} is ready for members and shared documents.`);
    } catch (requestError) {
      addToast('error', 'Team Creation Failed', requestError instanceof Error ? requestError.message : 'Unable to create team.');
    }
  };

  const addMember = async () => {
    if (!teamId || !selectedMember) return;
    try {
      await teamRequest(`/teams/${encodeURIComponent(teamId)}/members`, { method: 'POST', body: JSON.stringify({ userId: selectedMember }) });
      setSelectedMember('');
      await Promise.all([loadTeam(), refreshDocuments()]);
      addToast('success', 'Member Added', 'The user is now a member of this team.');
    } catch (requestError) {
      addToast('error', 'Could Not Add Member', requestError instanceof Error ? requestError.message : 'Unable to update team membership.');
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (!teamId) return;
    try {
      await teamRequest(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' });
      await Promise.all([loadTeam(), refreshDocuments()]);
    } catch (requestError) {
      addToast('error', 'Could Not Remove Member', requestError instanceof Error ? requestError.message : 'Unable to update team membership.');
    }
  };

  const updateShare = async (documentId: string, userId?: string) => {
    if (!teamId) return;
    try {
      await teamRequest(`/teams/${encodeURIComponent(teamId)}/document-shares/${encodeURIComponent(documentId)}`, {
        method: 'PUT', body: JSON.stringify({ role: roles[`${documentId}:${userId || ''}`] || 'viewer', ...(userId ? { userId } : {}) }),
      });
      await Promise.all([loadTeam(), refreshDocuments()]);
      addToast('success', userId ? 'Member Access Updated' : 'Approval Requested', userId ? 'The selected team member now has the chosen access.' : 'The manager must approve this request before other team members can access the document.');
    } catch (requestError) {
      addToast('error', 'Sharing Failed', requestError instanceof Error ? requestError.message : 'Unable to share this document.');
    }
  };

  const revokeShare = async (documentId: string, userId: string) => {
    if (!teamId) return;
    try {
      await teamRequest(`/teams/${encodeURIComponent(teamId)}/document-shares/${encodeURIComponent(documentId)}/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      await Promise.all([loadTeam(), refreshDocuments()]);
      addToast('info', 'Team Access Removed', 'Team access to this document has been revoked.');
    } catch (requestError) {
      addToast('error', 'Revocation Failed', requestError instanceof Error ? requestError.message : 'Unable to revoke access.');
    }
  };

  const reviewShareRequest = async (requestId: string, decision: 'approve' | 'reject') => {
    if (!teamId) return;
    try {
      await teamRequest(`/teams/${encodeURIComponent(teamId)}/document-share-requests/${encodeURIComponent(requestId)}`, {
        method: 'PATCH', body: JSON.stringify({ decision }),
      });
      await Promise.all([loadTeam(), refreshDocuments()]);
      addToast(decision === 'approve' ? 'success' : 'info', decision === 'approve' ? 'Share Approved' : 'Share Rejected', 'The team sharing request has been reviewed.');
    } catch (requestError) {
      addToast('error', 'Could Not Review Request', requestError instanceof Error ? requestError.message : 'Unable to review the request.');
    }
  };

  const deleteTeamDocuments = async () => {
    if (!teamId || !window.confirm('Permanently delete every document assigned to this team? This cannot be undone.')) return;
    try {
      const result = await teamRequest(`/teams/${encodeURIComponent(teamId)}/documents`, { method: 'DELETE' });
      await Promise.all([loadTeam(), refreshDocuments()]);
      addToast('success', 'Team Documents Deleted', `${result.deletedCount} document(s) permanently deleted.`);
    } catch (requestError) {
      addToast('error', 'Could Not Delete Documents', requestError instanceof Error ? requestError.message : 'Unable to delete team documents.');
    }
  };

  const deleteTeam = async () => {
    if (!teamId || !window.confirm('Delete this team? Its members will be removed, but their documents will be kept.')) return;
    try {
      await teamRequest(`/teams/${encodeURIComponent(teamId)}`, { method: 'DELETE' });
      const remaining = teams.filter(team => team.id !== teamId);
      setTeams(remaining);
      setTeamId(remaining[0]?.id || '');
      setMembers([]);
      setShares([]);
      setShareRequests([]);
      await refreshDocuments();
      addToast('success', 'Team Deleted', 'The team was deleted. Documents were kept.');
    } catch (requestError) {
      addToast('error', 'Could Not Delete Team', requestError instanceof Error ? requestError.message : 'Unable to delete the team.');
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Team workspace</p><h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{teams.find(team => team.id === teamId)?.name || 'Your teams'}</h1><p className="mt-1 text-sm text-slate-500">{canManageTeams ? 'Manage membership and grant document access by role.' : 'Share your documents with members of your teams.'}</p></div>
        <div className="flex flex-wrap items-center gap-2">{teams.length > 0 && <select aria-label="Select team" value={teamId} onChange={event => setTeamId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select>}<button onClick={() => void loadTeam()} disabled={!teamId || loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><RefreshCw size={15} /> Refresh</button>{canManageTeams && teamId && <><button onClick={() => void deleteTeamDocuments()} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"><Trash2 size={15} /> Delete team documents</button><button onClick={() => void deleteTeam()} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-sm text-white hover:bg-rose-800"><Trash2 size={15} /> Delete team</button></>}</div>
      </header>
      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {canManageTeams && <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold text-slate-900 dark:text-white">Create another team</h2>
        <p className="mt-1 text-xs text-slate-500">You can manage multiple workspaces. Add existing active user accounts to each team.</p>
        <form onSubmit={createTeam} className="mt-3 flex flex-wrap gap-2"><input value={teamName} onChange={event => setTeamName(event.target.value)} minLength={2} maxLength={80} required placeholder="New team name" className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" /><button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"><Plus size={16} /> Create team</button></form>
      </section>}
      {!teamId && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{canManageTeams ? 'Create a team to start adding members and sharing documents.' : 'You are not part of a team yet. Ask a workspace manager to add your account to a team.'}</div>}
      {teamId && <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2"><Users size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900 dark:text-white">Members ({members.length})</h2></div>
        <div className="flex flex-wrap gap-2">
          {canManageTeams && <><select value={selectedMember} onChange={event => setSelectedMember(event.target.value)} className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="">Choose an active user</option>{availableMembers.map(member => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
          </select><button disabled={!selectedMember} onClick={() => void addMember()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add member</button></>}
        </div>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{members.map(member => <li key={member.id} className="flex items-center justify-between py-3 text-sm"><div><p className="font-medium text-slate-800 dark:text-slate-100">{member.name}{member.id === currentUser.id ? ' (you)' : ''}</p><p className="text-xs text-slate-500">{member.email}</p></div>{canManageTeams && member.id !== currentUser.id && <button onClick={() => void removeMember(member)} title="Remove from team" className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><UserMinus size={16} /></button>}</li>)}</ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2"><Share2 size={18} className="text-indigo-600" /><h2 className="font-semibold text-slate-900 dark:text-white">Team document access</h2></div>
        <div className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2 dark:bg-slate-950 dark:text-slate-300"><p><strong>Viewer:</strong> can view and comment; download depends on classification.</p><p><strong>Editor:</strong> can view, download, comment and update metadata.</p></div>
        {canManageTeams && shareRequests.length > 0 && <div className="mb-4 space-y-2">{shareRequests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30"><div><strong>{request.title}</strong><span className="ml-2 text-slate-600 dark:text-slate-300">Requested by {request.requesterName} as {request.requestedRole}</span></div><div className="flex gap-2"><button onClick={() => void reviewShareRequest(request.id, 'approve')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">Approve</button><button onClick={() => void reviewShareRequest(request.id, 'reject')} className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-700">Reject</button></div></div>)}</div>}
        {teamDocuments.length === 0 ? <p className="text-sm text-slate-500">No documents from this team’s members are available yet. Upload a document or add a team member first.</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{teamDocuments.map(doc => {
          const pending = shareRequests.find(item => item.documentId === doc.id && item.requesterId === currentUser.id && item.status === 'pending');
          const approvedRequest = shareRequests.find(item => item.documentId === doc.id && item.requesterId === currentUser.id && item.status === 'approved');
          const rejectedRequest = shareRequests.find(item => item.documentId === doc.id && item.requesterId === currentUser.id && item.status === 'rejected');
          return <li key={doc.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><FileLock2 size={17} className="shrink-0 text-slate-400" /><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{doc.title}</p><p className="text-xs text-slate-500">{doc.ownerName} · {doc.sensitivity} · {formatBytes(doc.fileSizeBytes)}{doc.hasFileContent === false ? ' · file missing' : ''}</p></div></div>{!canManageTeams && doc.ownerId === currentUser.id && <div className="flex items-center gap-2">{pending ? <span className="text-xs text-amber-700">Awaiting manager approval</span> : approvedRequest ? <span className="text-xs text-emerald-700">Approved for the team</span> : <><select value={roles[`${doc.id}:` ] || 'viewer'} onChange={event => setRoles(previous => ({ ...previous, [`${doc.id}:`]: event.target.value as 'viewer' | 'editor' }))} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button onClick={() => void updateShare(doc.id)} disabled={doc.hasFileContent === false} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{rejectedRequest ? 'Resubmit request' : 'Request team access'}</button></>}</div>}</div>{canManageTeams && <div className="mt-3 grid gap-2 sm:grid-cols-2">{members.map(member => { const access = shares.find(item => item.documentId === doc.id && item.userId === member.id && item.status === 'approved'); const key = `${doc.id}:${member.id}`; return <div key={member.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 dark:bg-slate-950"><span className="truncate text-xs text-slate-700 dark:text-slate-200">{member.name}</span><div className="flex items-center gap-1.5"><select value={roles[key] || access?.role || 'viewer'} onChange={event => setRoles(previous => ({ ...previous, [key]: event.target.value as 'viewer' | 'editor' }))} className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button onClick={() => void updateShare(doc.id, member.id)} disabled={doc.ownerId === member.id || doc.hasFileContent === false} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50">{access ? 'Update' : 'Grant'}</button>{access && <button onClick={() => void revokeShare(doc.id, member.id)} className="rounded border border-slate-300 px-2 py-1 text-xs">Revoke</button>}</div></div>; })}</div>}</li>;
        })}</ul>}
      </section>
      </>}
    </div>
  );
};
