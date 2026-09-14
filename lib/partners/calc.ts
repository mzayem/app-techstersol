export type PartnerSplitInput = {
  revenue: number;
  workCost: number;
  projectExpenses: number;
  sharePercent: number;
};

export type PartnerSplitResult = PartnerSplitInput & {
  profit: number;
  partnerShareAmount: number;
  remainderShare: number;
};

export function computePartnerSplit(
  input: PartnerSplitInput,
): PartnerSplitResult {
  const profit = input.revenue - input.workCost - input.projectExpenses;
  const partnerShareAmount = (profit * input.sharePercent) / 100;
  const remainderShare = profit - partnerShareAmount;
  return { ...input, profit, partnerShareAmount, remainderShare };
}
