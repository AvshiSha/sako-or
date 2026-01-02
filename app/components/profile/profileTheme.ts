export const profileTheme = {
  pageBg:
    'min-h-[calc(100vh-0px)] bg-gradient-to-b from-[#eef5ff] via-[#f4f7ff] to-white',
  shell: 'mx-auto w-full max-w-2xl px-4 py-4 sm:py-8 mt-26 ',
  card: 'rounded-lg bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur',
  header: 'flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5',
  avatar:
    'h-12 w-12 shrink-0 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center',
  title: 'text-xl sm:text-2xl font-semibold tracking-tight text-slate-900',
  subtitle: 'mt-1 text-xs sm:text-sm text-slate-500',

  section: 'px-6 py-6 sm:px-8',
  sectionTitle: 'text-sm font-semibold text-slate-900 mb-4',
  grid: 'mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2',

  label: 'block text-sm font-medium text-slate-700 mb-1.5',
  input:
    'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[#856D55] focus:ring-2 focus:ring-[#856D55]',
  inputDisabled: 'bg-slate-50 text-slate-500',

  hint: 'mt-1 text-xs text-slate-500',
  error: 'mt-1 text-xs text-red-600',

  actions: 'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end',
  buttonPrimary:
    'inline-flex items-center justify-center rounded-md bg-[#856D55]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#856D55] focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed',
  buttonSecondary:
    'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#856D55] disabled:opacity-50 disabled:cursor-not-allowed'
} as const


