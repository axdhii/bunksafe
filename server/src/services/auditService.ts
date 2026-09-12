import { prisma } from '../prisma/client.js';

export interface LogActionParams {
  actorEmail: string;
  actorRole: string;
  action: string;
  targetEntity?: string;
  targetId?: string;
  details?: Record<string, any> | string;
  ipAddress?: string;
}

export async function logAuditAction(params: LogActionParams): Promise<void> {
  try {
    const detailsStr = typeof params.details === 'object' 
      ? JSON.stringify(params.details) 
      : params.details;

    await prisma.auditLog.create({
      data: {
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        action: params.action,
        targetEntity: params.targetEntity,
        targetId: params.targetId,
        details: detailsStr,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
