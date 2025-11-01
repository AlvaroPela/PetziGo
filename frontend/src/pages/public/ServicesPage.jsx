
								<Select label="Ordenar" value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} options={SORT_OPTIONS} />
							</div>
						</div>
						<div className="space-y-3">
							<div>
								<Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
							</div>
							<div>
								<Input label="Precio mínimo" type="number" min="0" step="0.01" value={minPrice} onChange={setMinPrice} placeholder="0" />
							</div>
							<div>
								<Input label="Precio máximo" type="number" min="0" step="0.01" value={maxPrice} onChange={setMaxPrice} placeholder="∞" />
							</div>
							<div>
								<Input label="Buscar" value={search} onChange={setSearch} placeholder="palabra clave en título o descripción" />
							</div>
							<div>
								<Input label="Provider ID (opcional)" value={providerId} onChange={setProviderId} placeholder="id del proveedor" />
							</div>
						</div>
						{filterError && <p className="text-red-600 mt-2">{filterError}</p>}
						<div className="mt-3 flex items-center gap-2">
							<Button onClick={() => { setPage(1); loadWithFilters(); }} disabled={loading}>Aplicar filtros</Button>
							<Button onClick={() => { resetFilters(); setSortBy('relevance'); setPage(1); }} variant="outline" disabled={loading}>Resetear</Button>
						</div>
					</div>
				</div>

				{/* Contenido principal */}
				<div className="md:col-span-3">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h1 className="text-2xl font-bold">Servicios</h1>
					<p className="text-sm text-gray-500">Explora y filtra servicios de proveedores verificados.</p>
				</div>
				<div className="flex items-center gap-2">
					{(auth.user && auth.user.role === 'PROVIDER') && (
						<Button onClick={openCreate}>
							Nuevo servicio
						</Button>
					)}
				</div>
			</div>

			{/* --- Panel de filtros --- */}
			<div className="mb-4 p-4 border rounded-2xl bg-white">
				<div className="flex items-center justify-between mb-2">
					<h2 className="font-semibold">Filtros</h2>
					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-500 hidden md:inline">{sortedServices.length} resultados</span>
						<Select label="Ordenar" value={sortBy} onChange={(v) => { setSortBy(v); setPage(1); }} options={SORT_OPTIONS} />
					</div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<div>
						<Select label="Categoría" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
					</div>

					<div>
						<Input label="Precio mínimo" type="number" min="0" step="0.01" value={minPrice} onChange={setMinPrice} placeholder="0" />
					</div>

					<div>
						<Input label="Precio máximo" type="number" min="0" step="0.01" value={maxPrice} onChange={setMaxPrice} placeholder="∞" />
					</div>

					{/* <div>
						<label className="block text-sm font-medium">Rating</label>
						<select value={rating} onChange={(e) => setRating(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
							{RATING_OPTIONS.map((opt) => (
								<option key={opt.value || "any"} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					</div> */}

					<div>
						<Input label="Buscar" value={search} onChange={setSearch} placeholder="palabra clave en título o descripción" />
					</div>

					<div>
						<Input label="Provider ID (opcional)" value={providerId} onChange={setProviderId} placeholder="id del proveedor" />
					</div>
				</div>

				{filterError && <p className="text-red-600 mt-2">{filterError}</p>}

				<div className="mt-3 flex items-center gap-2">
					<Button onClick={() => { setPage(1); loadWithFilters(); }} disabled={loading}>Aplicar filtros</Button>
					<Button onClick={() => { resetFilters(); setSortBy('relevance'); setPage(1); }} variant="outline" disabled={loading}>Resetear</Button>
				</div>
			</div>

			{loading && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="rounded-lg border p-4 bg-white animate-pulse">
							<div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
							<div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
							<div className="h-40 bg-gray-100 rounded mb-4" />
							<div className="h-4 bg-gray-200 rounded w-1/3" />
						</div>
					))}
				</div>
			)}
			{error && <p className="text-red-600">{error}</p>}

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{visible.map((s) => (
					<div key={s.id} className="rounded-lg border p-4 bg-white">
						<div className="flex items-start justify-between">
							<h3 className="font-semibold text-lg line-clamp-1">{s.title}</h3>
							<span className="ml-2 inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">{s.category}</span>
						</div>
						<div
							className="mt-2 h-36 w-full overflow-hidden rounded bg-slate-50 flex items-center justify-center relative"
							onClick={() => { if (s.image_url) setImgModal({ open: true, src: assetUrl(s.image_url), alt: s.title }); }}
							role={s.image_url ? 'button' : undefined}
							aria-label={s.image_url ? 'Abrir imagen' : undefined}
							style={{ cursor: s.image_url ? 'zoom-in' : 'default' }}
						>
							{s.image_url ? (
								<>
									<img src={assetUrl(s.image_url)} alt={s.title} className="h-full w-full object-cover" />
									<div className="absolute bottom-1 right-1 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 pointer-events-none select-none">
										Haz clic para ampliar
									</div>
								</>
							) : (
								<div className="text-xs text-slate-500">Sin imagen</div>
							)}
						</div>
						<p className="mt-2 text-sm text-gray-600 line-clamp-2">{s.description}</p>
						<div className="mt-3 flex items-center justify-between">
							<div className="text-sm text-gray-500">
								<div className="font-medium text-gray-700">{s.provider_name}</div>
							{/* Contenido principal */}
			
				}}
				ariaLabel="Formulario servicio"
			>
				<ServiceForm
					initial={editing}
					onSaved={handleSaved}
					onCancel={() => {
						setOpen(false);
						setEditing(null);
					}}
				/>
			</Modal>
		</div>
	);
};

export default ServicesPage;
