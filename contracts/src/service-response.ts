import { z } from 'zod';

export const serviceResponseSchema = <T extends z.ZodType>(responseObjectSchema: T) =>
  z
    .object({
      success: z.boolean(),
      message: z.string(),
      responseObject: responseObjectSchema,
      statusCode: z.number().int().min(100).max(599),
    })
    .strict();

export type ServiceResponse<T> = {
  success: boolean;
  message: string;
  responseObject: T;
  statusCode: number;
};
