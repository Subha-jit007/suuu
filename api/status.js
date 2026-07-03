// Hosted status: no CLI on Vercel — key mode only.
module.exports = (req, res) => {
  res.status(200).json({ cli: false, hosted: true, soul: true });
};
