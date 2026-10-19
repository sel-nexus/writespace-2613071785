/** Display one actual administrator statistic with a compact colored icon. */
import PropTypes from "prop-types";

const colors = {
  indigo: "bg-indigo-100 text-indigo-700",
  violet: "bg-violet-100 text-violet-700",
  pink: "bg-pink-100 text-pink-700",
  teal: "bg-teal-100 text-teal-700",
};

/** Render an accessible labeled count.
 * @param {object} props Statistic label, numeric value and accent color.
 * @returns {JSX.Element} Statistic card.
 */
export function StatCard({ label, value, color = "indigo" }) {
  return (
    <section
      aria-label={label}
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={`rounded-lg p-2 ${colors[color]}`} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M5 19V9m7 10V5m7 14v-7M3 21h18" />
          </svg>
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-800">
        {value}
      </p>
    </section>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  color: PropTypes.oneOf(Object.keys(colors)),
};
