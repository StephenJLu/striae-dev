import { resolveAuditWorkerBaseUrl } from '../config';
import { deleteFirebaseAuthUser } from '../firebase/admin';
import { readUserRecord } from '../storage/user-records';
import type { AccountDeletionProgressEvent, Env } from '../types';

async function deleteSingleCase(env: Env, userUid: string, caseNumber: string): Promise<void> {
  const encodedUserId = encodeURIComponent(userUid);
  const encodedCaseNumber = encodeURIComponent(caseNumber);
  const casePrefix = `${encodedUserId}/${encodedCaseNumber}/`;
  const deletionErrors: string[] = [];
  const dataKeys: string[] = [];
  const fileIds: string[] = [];
  let dataCursor: string | undefined;

  do {
    const listed = await env.STRIAE_DATA.list({ prefix: casePrefix, cursor: dataCursor, limit: 1000 });

    for (const obj of listed.objects) {
      dataKeys.push(obj.key);

      const segments = obj.key.split('/');
      if (segments.length === 4 && segments[3] === 'data.json') {
        try {
          fileIds.push(decodeURIComponent(segments[2]));
        } catch {
          fileIds.push(segments[2]);
        }
      }
    }

    dataCursor = listed.truncated ? listed.cursor : undefined;
  } while (dataCursor !== undefined);

  for (const fileId of fileIds) {
    try {
      await env.STRIAE_FILES.delete(fileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown file delete error';
      deletionErrors.push(`file ${fileId} delete threw (${message})`);
    }
  }

  if (dataKeys.length > 0) {
    try {
      await env.STRIAE_DATA.delete(dataKeys);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown data delete error';
      deletionErrors.push(`case data delete threw (${message})`);
    }
  }

  if (deletionErrors.length > 0) {
    throw new Error(`Case cleanup incomplete for ${caseNumber}: ${deletionErrors.join('; ')}`);
  }
}

async function deleteUserConfirmationSummary(env: Env, userUid: string): Promise<void> {
  const encodedUserId = encodeURIComponent(userUid);
  const key = `${encodedUserId}/meta/confirmation-status.json`;

  try {
    await env.STRIAE_DATA.delete(key);
  } catch (error) {
    throw new Error(`Failed to delete confirmation summary metadata: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

async function deleteUserAuditLogs(
  env: Env,
  userUid: string,
  defaultAuditWorkerBaseUrl: string
): Promise<void> {
  const auditWorkerBaseUrl = resolveAuditWorkerBaseUrl(env, defaultAuditWorkerBaseUrl);
  const encodedUserId = encodeURIComponent(userUid);

  const response = await fetch(`${auditWorkerBaseUrl}/audit/?userId=${encodedUserId}`, {
    method: 'DELETE',
    headers: { 'X-Custom-Auth-Key': env.R2_KEY_SECRET }
  });

  if (!response.ok) {
    throw new Error(`Failed to delete user audit logs: ${response.status}`);
  }
}

export async function executeUserDeletion(
  env: Env,
  userUid: string,
  defaultAuditWorkerBaseUrl: string,
  reportProgress?: (progress: AccountDeletionProgressEvent) => void
): Promise<{ success: boolean; message: string; totalCases: number; completedCases: number }> {
  const userData = await readUserRecord(env, userUid);
  if (userData === null) {
    throw new Error('User not found');
  }

  const ownedCases = (userData.cases || []).map((caseItem) => caseItem.caseNumber);
  const readOnlyCases = (userData.readOnlyCases || []).map((caseItem) => caseItem.caseNumber);
  const allCaseNumbers = Array.from(new Set([...ownedCases, ...readOnlyCases]));
  const totalCases = allCaseNumbers.length;
  let completedCases = 0;
  const caseCleanupErrors: string[] = [];

  reportProgress?.({
    event: 'start',
    totalCases,
    completedCases
  });

  for (const caseNumber of allCaseNumbers) {
    reportProgress?.({
      event: 'case-start',
      totalCases,
      completedCases,
      currentCaseNumber: caseNumber
    });

    let caseDeletionError: string | null = null;
    try {
      await deleteSingleCase(env, userUid, caseNumber);
    } catch (error) {
      caseDeletionError = error instanceof Error ? error.message : `Case cleanup failed for ${caseNumber}`;
      caseCleanupErrors.push(caseDeletionError);
      console.error(`Case cleanup error for ${caseNumber}:`, error);
    }

    completedCases += 1;

    reportProgress?.({
      event: 'case-complete',
      totalCases,
      completedCases,
      currentCaseNumber: caseNumber,
      success: caseDeletionError === null,
      message: caseDeletionError || undefined
    });
  }

  if (caseCleanupErrors.length > 0) {
    throw new Error(`Failed to fully delete all case data: ${caseCleanupErrors.join(' | ')}`);
  }

  await deleteUserConfirmationSummary(env, userUid);

  try {
    await deleteUserAuditLogs(env, userUid, defaultAuditWorkerBaseUrl);
  } catch (error) {
    console.error('Failed to delete user audit logs during account deletion (non-blocking):', error);
  }

  await deleteFirebaseAuthUser(env, userUid);
  await env.USER_DB.delete(userUid);

  return {
    success: true,
    message: 'Account successfully deleted',
    totalCases,
    completedCases
  };
}