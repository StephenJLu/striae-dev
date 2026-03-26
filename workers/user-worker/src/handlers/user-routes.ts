import { executeUserDeletion } from '../cleanup/account-deletion';
import { readUserRecord, writeUserRecord } from '../storage/user-records';
import type {
  AddCasesRequest,
  AccountDeletionProgressEvent,
  DeleteCasesRequest,
  Env,
  ResponseHeaders,
  UserData,
  UserRequestData
} from '../types';

function createJsonResponse(data: unknown, headers: ResponseHeaders, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

export async function handleGetUser(
  env: Env,
  userUid: string,
  corsHeaders: ResponseHeaders
): Promise<Response> {
  try {
    const userData = await readUserRecord(env, userUid);
    if (userData === null) {
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    return createJsonResponse(userData, corsHeaders);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown user data read error';
    console.error('Failed to get user data:', { uid: userUid, reason: errorMessage });

    return new Response('Failed to get user data', {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function handleAddUser(
  request: Request,
  env: Env,
  userUid: string,
  corsHeaders: ResponseHeaders
): Promise<Response> {
  try {
    const requestData: UserRequestData = await request.json();
    const { email, firstName, lastName, company, badgeId, permitted } = requestData;
    const normalizedBadgeId = typeof badgeId === 'string' ? badgeId.trim() : undefined;
    const existingUser = await readUserRecord(env, userUid);

    let userData: UserData;
    if (existingUser !== null) {
      userData = {
        ...existingUser,
        email: email || existingUser.email,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
        company: company || existingUser.company,
        badgeId: normalizedBadgeId !== undefined ? normalizedBadgeId : (existingUser.badgeId ?? ''),
        permitted: permitted !== undefined ? permitted : existingUser.permitted,
        updatedAt: new Date().toISOString()
      };
      if (requestData.readOnlyCases !== undefined) {
        userData.readOnlyCases = requestData.readOnlyCases;
      }
    } else {
      userData = {
        uid: userUid,
        email: email || '',
        firstName: firstName || '',
        lastName: lastName || '',
        company: company || '',
        badgeId: normalizedBadgeId ?? '',
        permitted: permitted !== undefined ? permitted : true,
        cases: [],
        createdAt: new Date().toISOString()
      };
      if (requestData.readOnlyCases !== undefined) {
        userData.readOnlyCases = requestData.readOnlyCases;
      }
    }

    await writeUserRecord(env, userUid, userData);

    return createJsonResponse(userData, corsHeaders, existingUser !== null ? 200 : 201);
  } catch {
    return new Response('Failed to save user data', {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function handleDeleteUser(
  env: Env,
  userUid: string,
  corsHeaders: ResponseHeaders,
  defaultAuditWorkerBaseUrl: string
): Promise<Response> {
  try {
    const result = await executeUserDeletion(env, userUid, defaultAuditWorkerBaseUrl);

    return createJsonResponse({
      success: result.success,
      message: result.message
    }, corsHeaders);
  } catch (error) {
    console.error('Delete user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    if (errorMessage === 'User not found') {
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    return createJsonResponse({
      success: false,
      message: 'Failed to delete user account'
    }, corsHeaders, 500);
  }
}

export function handleDeleteUserWithProgress(
  env: Env,
  userUid: string,
  corsHeaders: ResponseHeaders,
  defaultAuditWorkerBaseUrl: string
): Response {
  const sseHeaders: ResponseHeaders = {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendEvent = (payload: AccountDeletionProgressEvent): void => {
        controller.enqueue(encoder.encode(`event: ${payload.event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      try {
        const result = await executeUserDeletion(env, userUid, defaultAuditWorkerBaseUrl, sendEvent);
        sendEvent({
          event: 'complete',
          totalCases: result.totalCases,
          completedCases: result.completedCases,
          success: result.success,
          message: result.message
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete user account';

        sendEvent({
          event: 'error',
          totalCases: 0,
          completedCases: 0,
          success: false,
          message: errorMessage
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders
  });
}

export async function handleAddCases(
  request: Request,
  env: Env,
  userUid: string,
  corsHeaders: ResponseHeaders
): Promise<Response> {
  try {
    const { cases = [] }: AddCasesRequest = await request.json();
    const userData = await readUserRecord(env, userUid);
    if (!userData) {
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    const existingCases = userData.cases || [];
    const newCases = cases.filter((newCase) =>
      !existingCases.some((existingCase) => existingCase.caseNumber === newCase.caseNumber)
    );

    userData.cases = [...existingCases, ...newCases];
    userData.updatedAt = new Date().toISOString();
    await writeUserRecord(env, userUid, userData);

    return createJsonResponse(userData, corsHeaders);
  } catch {
    return new Response('Failed to add cases', {
      status: 500,
      headers: corsHeaders
    });
  }
}

export async function handleDeleteCases(
  request: Request,
  env: Env,
  userUid: string,
  corsHeaders: ResponseHeaders
): Promise<Response> {
  try {
    const { casesToDelete }: DeleteCasesRequest = await request.json();
    const userData = await readUserRecord(env, userUid);
    if (!userData) {
      return new Response('User not found', {
        status: 404,
        headers: corsHeaders
      });
    }

    userData.cases = userData.cases.filter((caseItem) => !casesToDelete.includes(caseItem.caseNumber));
    userData.updatedAt = new Date().toISOString();
    await writeUserRecord(env, userUid, userData);

    return createJsonResponse(userData, corsHeaders);
  } catch {
    return new Response('Failed to delete cases', {
      status: 500,
      headers: corsHeaders
    });
  }
}