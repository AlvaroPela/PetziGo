import React from "react";

export function Input({ label, type = "text", value, onChange, placeholder, required, autoComplete = "new-field" }) {
	return (
		<label className="block">
			<span className="text-sm font-medium text-gray-700">{label}</span>
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				required={required}
				//autoComplete={autoComplete}
				className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
			/>
		</label>
	);
}

export function Select({ label, value, onChange, options }) {
	return (
		<label className="block">
			<span className="text-sm font-medium text-gray-700">{label}</span>
			<select
				className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</label>
	);
}

export function StatusBadge({ status }) {
	const style =
		{
			PENDING: "bg-yellow-100 text-yellow-800",
			APPROVED: "bg-green-100 text-green-800",
			REJECTED: "bg-red-100 text-red-800",
		}[status] || "bg-slate-100 text-slate-700";

	return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{status}</span>;
}

export function Card({ title, description, actions, children, footer }) {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-start justify-between gap-4">
				<div>
					<h2 className="text-base font-semibold text-slate-900">{title}</h2>
					{description && <p className="text-sm text-slate-500">{description}</p>}
				</div>
				{actions}
			</div>
			<div className="space-y-4">{children}</div>
			{footer && <div className="mt-4 text-sm text-gray-500">{footer}</div>}
		</div>
	);
}
