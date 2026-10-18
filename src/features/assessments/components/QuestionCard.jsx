export default function QuestionCard({
  question,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <legend className="mb-5 whitespace-pre-wrap wrap-break-word text-xl font-bold text-[#304744] sm:text-2xl">
        {question.prompt}
      </legend>
      {question.options.map((option, index) => (
        <label
          key={index}
          className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-colors focus-within:ring-4 focus-within:ring-[#4CDB59]/30 sm:gap-4 sm:p-5 ${value === index ? "border-[#304744] bg-[#E9F8EA] shadow-[0_0_0_2px_rgba(48,71,68,0.08)]" : "border-[#E2E9E0] bg-white hover:border-[#79B782]"} ${disabled ? "cursor-not-allowed opacity-75" : ""}`}
        >
          <input
            type="radio"
            name={question.questionId}
            checked={value === index}
            onChange={() => onChange(index)}
            className="h-5 w-5 shrink-0 accent-[#304744]"
          />
          <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-base font-medium text-[#304744] sm:text-lg">
            {option}
          </span>
          {value === index && (
            <span
              aria-hidden="true"
              className="shrink-0 rounded-full bg-[#304744] px-2 py-1 text-xs font-semibold text-white"
            >
              Seleccionada
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
