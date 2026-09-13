import type { MilestoneInput } from "@/lib/contracts/constants";

export function validateMilestones(milestones: MilestoneInput[]) {
  for (const milestone of milestones) {
    if (
      typeof milestone.name !== "string" ||
      typeof milestone.amount !== "number" ||
      typeof milestone.deadline !== "string" ||
      !milestone.name.trim() ||
      !milestone.deadline ||
      !(milestone.amount > 0)
    ) {
      throw new Error("Each milestone needs a name, amount, and deadline");
    }
  }
}
