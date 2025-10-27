import React from "react";

const baseFieldClasses =
	"mt-1 w-full rounded-2xl border border-slate-300/80 bg-white px-3.5 py-2.5 shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-400 placeholder:text-slate-400";

export function Input({ label, type = "text", value, onChange, placeholder, required, disabled, autoComplete = "new-field", className = "", helperText, error, ...props }) {
	return (
		<label className="block">
			{label && <span className="text-sm font-medium text-slate-700">{label}</span>}
			<input
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				required={required}
				disabled={disabled}
				//autoComplete={autoComplete}
				className={`${baseFieldClasses} ${error ? "border-rose-300 focus:ring-rose-300 focus:border-rose-400" : ""} ${disabled ? "bg-slate-50 text-slate-400" : ""} ${className}`}
				{...props}
			/>
			{helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
			{error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
		</label>
	);
}

export function Textarea({ label, value, onChange, rows = 3, placeholder, required, disabled, className = "", helperText, error, ...props }) {
	return (
		<label className="block">
			{label && <span className="text-sm font-medium text-slate-700">{label}</span>}
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				rows={rows}
				placeholder={placeholder}
				required={required}
				disabled={disabled}
				className={`${baseFieldClasses} ${error ? "border-rose-300 focus:ring-rose-300 focus:border-rose-400" : ""} ${disabled ? "bg-slate-50 text-slate-400" : ""} ${className}`}
				{...props}
			/>
			{helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
			{error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
		</label>
	);
}

export function Select({ label, value, onChange, options = [], disabled, className = "", helperText, error, ...props }) {
	return (
		<label className="block">
			{label && <span className="text-sm font-medium text-slate-700">{label}</span>}
			<select
				className={`${baseFieldClasses} ${error ? "border-rose-300 focus:ring-rose-300 focus:border-rose-400" : ""} ${disabled ? "bg-slate-50 text-slate-400" : ""} ${className}`}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				{...props}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			{helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
			{error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
		</label>
	);
}

export function Button({ children, variant = "primary", className = "", ...props }) {
	const variants = {
		primary: "bg-violet-800 text-white hover:bg-violet-900 focus:ring-violet-400",
		secondary: "bg-slate-800 text-white hover:bg-slate-900 focus:ring-slate-400",
		outline: "bg-white text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50 focus:ring-violet-300",
		danger: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-300",
		soft: "bg-violet-50 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-100 focus:ring-violet-300",
	};
	const v = variants[variant] || variants.primary;
	return (
		<button
			className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 shadow-sm transition focus:outline-none focus:ring-2 ${v} ${className}`}
			{...props}
		>
			{children}
		</button>
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
