import { z } from 'zod';

/*
 * The signed-in IdamBox User's own effective access (docs/adr/0004), exactly as the
 * CurrentUserAccess contract component declares it: the parser narrows nothing.
 * Strapi computes it from Role -> Function -> FunctionApi; the client only reads it.
 */

const operationSchema = z.string().min(1);

const menuFunctionSchema = z.object({
  name: z.string().min(1),
  menuPath: z.string().min(1),
}).strict();

export const currentUserAccessSchema = z.object({
  displayName: z.string(),
  functions: z.array(menuFunctionSchema).max(500),
  operations: z.array(operationSchema).max(1000),
}).strict();

export const currentUserAccessResponseSchema = z.object({ data: currentUserAccessSchema }).strict();

export type CurrentUserAccess = z.infer<typeof currentUserAccessSchema>;

export function parseCurrentUserAccessPayload(payload: unknown): CurrentUserAccess {
  return currentUserAccessResponseSchema.parse(payload).data;
}
