import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Bridges CLAUDE.md's "all external input is validated with zod" rule into
 * NestJS's pipe mechanism. Used per-route: `@UsePipes(new ZodValidationPipe(SomeSchema))`.
 * Schemas come from `packages/types` so the same schema validates both sides.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
