import { user } from "@zero/db/schema";
import { privateProcedure, router } from "../trpc";
import { eq } from "drizzle-orm";

export const onboardingCheckRouter = router({
  check: privateProcedure.query(async ({ ctx }) => {
    const { db, session } = ctx;
    const [result] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);
    return result?.hasCompletedOnboarding;
  }),
  
  markCompleted: privateProcedure.mutation(async ({ ctx }) => {
    const { db, session } = ctx;
    await db
      .update(user)
      .set({ hasCompletedOnboarding: true })
      .where(eq(user.id, session.user.id));
    return true;
  }),
});
  