export default function RootLoading() {
  return (
    <div className="animate-fade-in px-3 pb-20 pt-[4.75rem] md:px-6 md:pb-6">
      <div className="space-y-4">
        <div className="skeleton h-8 w-40 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`root-loading-stat-${index}`} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-[360px] rounded-2xl" />
      </div>
    </div>
  )
}
