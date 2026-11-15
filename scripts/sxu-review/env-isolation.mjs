/** Credentials used only for Docker's first-run provisioning. */
export const composeOnlySecrets=["SXU_REVIEW_ADMIN_PASSWORD","SXU_REVIEW_BOOTSTRAP_REVIEWER_PASSWORD"];
export function withoutComposeSecrets(input) {
  return Object.fromEntries(Object.entries(input).filter(([key])=>!composeOnlySecrets.includes(key)));
}
export function withoutReviewEnvironment(input) {
  return Object.fromEntries(Object.entries(input).filter(([key])=>!key.startsWith("SXU_REVIEW_")&&!key.startsWith("SXU_LOCAL_REVIEW_")));
}
