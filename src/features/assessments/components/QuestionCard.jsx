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
          className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 transition-colors focus-within:ring-4 focus-within:ring-green-200 ${value === index ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:border-green-400"} ${disabled ? "opacity-70" : ""}`}
        >
          <input
            type="radio"
            name={question.questionId}
            checked={value === index}
            onChange={() => onChange(index)}
            className="h-5 w-5 shrink-0 accent-green-700"
          />
          <span className="min-w-0 whitespace-pre-wrap wrap-break-word text-base font-medium">
            {option}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
