module.exports = (data) => {
  // Critical fields
  if (!data.invoiceNumber || !data.totalAmount) {
    return "REJECTED";
  }

  // Confidence check
  if (data.confidence < 0.8) {
    return "MANUAL_REVIEW";
  }

  return "APPROVED";
};
