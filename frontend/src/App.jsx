import { useEffect, useMemo, useState } from 'react'
import { NavLink, Routes, Route, useLocation } from 'react-router-dom'
import {
  BookOpen, LayoutDashboard, Users, ArrowLeftRight, Clock3, Search,
  Plus, Menu, X, LibraryBig, ChevronRight, BookMarked, IndianRupee,
  RotateCcw, Trash2, Pencil, AlertCircle, CheckCircle2, Leaf, Tags
} from 'lucide-react'
import {
  getBooks, createBook, updateBook, deleteBook,
  getMembers, createMember, updateMember, deleteMember,
  getLoans, getOverdue, issueBook, returnBook,
  registerMember, loginUser, logoutUser,
  getMyLoans, getMyFines, payFine
} from './api'

const CATEGORIES = ['Novel', 'Fiction', 'Non-Fiction', 'History', 'Biography', 'Science', 'Children’s Books', 'Poetry', 'General']
const money = (value) => `₹${Number(value || 0).toFixed(2)}`
const dateText = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const errorText = (err) => {
  const data = err?.response?.data
  if (!data) return 'Could not connect to the server. Check that Django is running.'
  if (typeof data === 'string') return data
  return Object.entries(data).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ')
}

function AdminApp({ user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/books', label: 'Books & Categories', icon: BookOpen },
    { to: '/members', label: 'Members', icon: Users },
    { to: '/issue', label: 'Issue / Return', icon: ArrowLeftRight },
    { to: '/overdue', label: 'Overdue Books', icon: Clock3 },
  ]
  const pageTitle = links.find(x => x.to === location.pathname)?.label || 'Village Library'
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><LibraryBig size={23}/></div>
          <div><strong>GramPustaka</strong><span>VILLAGE LIBRARY</span></div>
          <button className="mobile-close icon-button" onClick={() => setMenuOpen(false)}><X size={19}/></button>
        </div>
        <div className="library-chip"><span className="online-dot"/> Library desk <b>●</b></div>
        <p className="nav-caption">LIBRARY MENU</p>
        <nav className="nav-list">
          {links.map(({to,label,icon:Icon}) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)} className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18}/><span>{label}</span>{to === '/overdue' && <ChevronRight className="nav-chevron" size={15}/>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon"><Leaf size={17}/></div>
          <strong>A little reading goes a long way.</strong>
          <p>Keeping stories and knowledge close to our community.</p>
        </div>
        <div className="sidebar-bottom"><span className="avatar">VL</span><div><b>Library Admin</b><small>Village Library</small></div></div>
      </aside>

      {menuOpen && <button aria-label="Close menu" className="mobile-scrim" onClick={() => setMenuOpen(false)}/>}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button>
            <div><div className="eyebrow">GRAMPUSTAKA <span>/</span> LIBRARY DESK</div><h1>{pageTitle}</h1></div>
          </div>
          <div className="topbar-right">
            <span className="today-pill">
              <span className="online-dot"/>
              <span>Library system</span>
            </span>
            <div className="top-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <button className="secondary-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard/>}/>
            <Route path="/books" element={<BooksPage/>}/>
            <Route path="/members" element={<MembersPage/>}/>
            <Route path="/issue" element={<IssuePage/>}/>
            <Route path="/overdue" element={<OverduePage/>}/>
          </Routes>
        </div>
        <footer className="footer"><span>© {new Date().getFullYear()} GramPustaka Village Library</span><span>Read • Learn • Grow <Leaf size={13}/></span></footer>
      </main>
    </div>
  )
}

function useLibraryData() {
  const [books,setBooks] = useState([])
  const [members,setMembers] = useState([])
  const [loans,setLoans] = useState([])
  const [overdue,setOverdue] = useState([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const refresh = async () => {
    setLoading(true); setError('')
    try {
      const results = await Promise.all([getBooks(),getMembers(),getLoans(),getOverdue()])
      setBooks(results[0].data.results || results[0].data)
      setMembers(results[1].data.results || results[1].data)
      setLoans(results[2].data.results || results[2].data)
      setOverdue(results[3].data.results || results[3].data)
    } catch (e) { setError(errorText(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  return { books,members,loans,overdue,loading,error,refresh,setBooks,setMembers }
}

function PageIntro({title,description,action}) {
  return <div className="page-intro"><div><p className="section-kicker">YOUR COMMUNITY, YOUR LIBRARY</p><h2>{title}</h2><p className="muted">{description}</p></div>{action}</div>
}
function Alert({children,type='error'}) { return children ? <div className={`alert ${type}`}><AlertCircle size={17}/><span>{children}</span></div> : null }
function StatCard({label,value,caption,icon:Icon,tone}) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-caption">{caption}</div></div>
}
function Dashboard() {
  const {books,members,loans,overdue,loading,error} = useLibraryData()
  const available = books.reduce((n,b)=>n+Number(b.copies_available || 0),0)
  const active = loans.filter(l=>!l.return_date).length
  const categories = useMemo(()=>CATEGORIES.map(name=>({name,count:books.filter(b=>b.category===name).length})).filter(x=>x.count),[books])
  return <>
    <div className="welcome-banner"><div className="welcome-copy"><span className="welcome-tag"><Leaf size={13}/> A PLACE FOR EVERY READER</span><h2>Welcome to your<br/><em>village library.</em></h2><p>Every book holds a new world. Let’s make it easy for everyone in our community to explore one.</p></div><div className="banner-art"><div className="sun-disc"/><div className="book-stack"><span/><span/><span/><span/></div><div className="plant">✳</div></div></div>
    <PageIntro title="Library at a glance" description="A quick look at what’s happening at your library today."/>
    <Alert>{error}</Alert>
    <div className="stats-grid">
      <StatCard label="Book titles" value={loading?'—':books.length} caption={`${available} copies available`} icon={BookOpen} tone="green"/>
      <StatCard label="Registered members" value={loading?'—':members.length} caption="Readers in our community" icon={Users} tone="blue"/>
      <StatCard label="Books on loan" value={loading?'—':active} caption="Currently with members" icon={ArrowLeftRight} tone="gold"/>
      <StatCard label="Overdue books" value={loading?'—':overdue.length} caption="Need a friendly reminder" icon={Clock3} tone="rose"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel category-panel"><div className="panel-heading"><div><h3>Explore categories</h3><p>Find a shelf that interests you.</p></div><Tags size={19}/></div>
        {categories.length > 0 ? (
          <div className="category-list">
            {categories.map((c, i) => (
              <div className="category-row" key={c.name}>
                <span className={`category-dot dot-${i % 5}`} />
                <span>{c.name}</span>
                <b>
                  {c.count} <small>titles</small>
                </b>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Add books to see your categories here." />
        )}      
        </section>
      <section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common library desk tasks.</p></div><BookMarked size={19}/></div>
        <div className="quick-actions"><NavLink to="/books"><span className="quick-icon q-green"><Plus size={18}/></span><span><b>Add a new book</b><small>Grow the collection</small></span><ChevronRight size={17}/></NavLink><NavLink to="/members"><span className="quick-icon q-blue"><Users size={18}/></span><span><b>Register a member</b><small>Welcome a new reader</small></span><ChevronRight size={17}/></NavLink><NavLink to="/issue"><span className="quick-icon q-gold"><ArrowLeftRight size={18}/></span><span><b>Issue a book</b><small>Record a new loan</small></span><ChevronRight size={17}/></NavLink></div>
      </section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h3>Recently issued books</h3><p>The latest loans recorded in the library.</p></div><NavLink className="text-link" to="/issue">View all <ChevronRight size={15}/></NavLink></div>
      {loans.length ? <div className="table-wrap"><table><thead><tr><th>BOOK</th><th>MEMBER</th><th>ISSUED ON</th><th>DUE DATE</th><th>STATUS</th></tr></thead><tbody>{[...loans].slice(-5).reverse().map(l=><tr key={l.id}><td><b>{l.book_title || `Book #${l.book}`}</b></td><td>{l.member_name || `Member #${l.member}`}</td><td>{dateText(l.issue_date)}</td><td>{dateText(l.due_date)}</td><td><span className={`status ${l.return_date?'returned':'active'}`}>{l.return_date?'Returned':'On loan'}</span></td></tr>)}</tbody></table></div> : <EmptyState text="No books have been issued yet."/>}
    </section>
  </>
}
function EmptyState({text}) { return <div className="empty-state"><BookOpen size={24}/><span>{text}</span></div> }
function BooksPage() {
  const {books,loading,error,refresh} = useLibraryData()
  const [search,setSearch] = useState('')
  const [category,setCategory] = useState('All')
  const [showForm,setShowForm] = useState(false)
  const [editing,setEditing] = useState(null)
  const [notice,setNotice] = useState('')
  const [failure,setFailure] = useState('')
  const filtered = books.filter(b=>(`${b.title} ${b.author}`.toLowerCase().includes(search.toLowerCase()))&&(category==='All'||b.category===category))
  const save = async (e) => {
    e.preventDefault(); setFailure(''); setNotice('')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    data.copies_available = Number(data.copies_available)
    try {
      if(editing) await updateBook(editing.id,data); else await createBook(data)
      setNotice(editing?'Book details updated.':'Book added to the collection.')
      setShowForm(false); setEditing(null); refresh()
    } catch(err) { setFailure(errorText(err)) }
  }
  const remove = async (book) => {
    if(!confirm(`Delete "${book.title}"?`)) return
    try { await deleteBook(book.id); setNotice('Book deleted.'); refresh() } catch(e) { setFailure(errorText(e)) }
  }
  return <>
    <PageIntro title="The book collection" description="Manage the stories, knowledge and learning resources on your shelves." action={<button className="primary-btn" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={17}/> Add a book</button>}/>
    <Alert>{error || failure}</Alert>{notice&&<div className="alert success"><CheckCircle2 size={17}/>{notice}</div>}
    {showForm&&<div className="panel form-panel"><div className="form-heading"><div><h3>{editing?'Edit book':'Add a book to the library'}</h3><p>Enter the book details below.</p></div><button className="icon-button" onClick={()=>setShowForm(false)}><X size={19}/></button></div>
      <form onSubmit={save} className="form-grid">
        <label>Book title<input name="title" defaultValue={editing?.title||''} required placeholder="e.g. The Alchemist"/></label>
        <label>Author<input name="author" defaultValue={editing?.author||''} required placeholder="Author name"/></label>
        <label>Category<select name="category" defaultValue={editing?.category||'Novel'}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>Available copies<input name="copies_available" type="number" min="0" defaultValue={editing?.copies_available ?? 1} required/></label>
        <div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary-btn"><CheckCircle2 size={16}/> Save book</button></div>
      </form></div>}
    <div className="toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title or author..."/></div><select className="filter-select" value={category} onChange={e=>setCategory(e.target.value)}><option>All</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><span className="result-count">{filtered.length} books</span></div>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>BOOK TITLE</th><th>AUTHOR</th><th>CATEGORY</th><th>AVAILABLE</th><th>ACTIONS</th></tr></thead><tbody>
      {filtered.map(b=><tr key={b.id}><td><div className="book-cell"><span className="mini-book"><BookOpen size={17}/></span><b>{b.title}</b></div></td><td>{b.author}</td><td><span className="category-pill">{b.category||'General'}</span></td><td><span className={Number(b.copies_available)>0?'stock-good':'stock-none'}>{b.copies_available} copies</span></td><td><div className="row-actions"><button title="Edit" onClick={()=>{setEditing(b);setShowForm(true);window.scrollTo({top:0,behavior:'smooth'})}}><Pencil size={16}/></button><button title="Delete" className="delete-action" onClick={()=>remove(b)}><Trash2 size={16}/></button></div></td></tr>)}
      {!filtered.length&&<tr><td colSpan="5"><EmptyState text={loading?'Loading books...':'No books found. Add your first book to get started.'}/></td></tr>}
    </tbody></table></div></section>
  </>
}
function MembersPage() {
  const {members,loans,loading,error,refresh} = useLibraryData()
  const [showForm,setShowForm]=useState(false),[editing,setEditing]=useState(null),[search,setSearch]=useState(''),[failure,setFailure]=useState(''),[notice,setNotice]=useState('')
  const filtered=members.filter(m=>`${m.name} ${m.email}`.toLowerCase().includes(search.toLowerCase()))
  const save=async e=>{e.preventDefault();setFailure('');const data=Object.fromEntries(new FormData(e.currentTarget).entries());try{if(editing)await updateMember(editing.id,data);else await createMember(data);setNotice(editing?'Member updated.':'Member registered.');setShowForm(false);setEditing(null);refresh()}catch(err){setFailure(errorText(err))}}
  const remove=async m=>{if(!confirm(`Delete member "${m.name}"?`))return;try{await deleteMember(m.id);refresh()}catch(e){setFailure(errorText(e))}}
  return <>
    <PageIntro title="Our readers" description="Keep track of the people who make this library a lively place." action={<button className="primary-btn" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={17}/> Register member</button>}/>
    <Alert>{error||failure}</Alert>{notice&&<div className="alert success"><CheckCircle2 size={17}/>{notice}</div>}
    {showForm&&<div className="panel form-panel"><div className="form-heading"><div><h3>{editing?'Edit member':'Register a new member'}</h3><p>Member name and a unique email address are required.</p></div><button className="icon-button" onClick={()=>setShowForm(false)}><X size={19}/></button></div><form onSubmit={save} className="form-grid two-col"><label>Full name<input name="name" defaultValue={editing?.name||''} required placeholder="Member full name"/></label><label>Email address<input name="email" type="email" defaultValue={editing?.email||''} required placeholder="name@example.com"/></label><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary-btn">Save member</button></div></form></div>}
    <div className="toolbar"><div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search members..."/></div><span className="result-count">{filtered.length} members</span></div>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>EMAIL ADDRESS</th><th>BOOKS ON LOAN</th><th>ACTIONS</th></tr></thead><tbody>{filtered.map(m=><tr key={m.id}><td><div className="member-cell"><span className="member-avatar">{m.name?.charAt(0)?.toUpperCase()}</span><b>{m.name}</b></div></td><td>{m.email}</td><td>{loans.filter(l=>String(l.member)===String(m.id)&&!l.return_date).length}</td><td><div className="row-actions"><button title="Edit" onClick={()=>{setEditing(m);setShowForm(true)}}><Pencil size={16}/></button><button title="Delete" className="delete-action" onClick={()=>remove(m)}><Trash2 size={16}/></button></div></td></tr>)}{!filtered.length&&<tr><td colSpan="4"><EmptyState text={loading?'Loading members...':'No members found. Register your first reader.'}/></td></tr>}</tbody></table></div></section>
  </>
}
function IssuePage() {
  const {books,members,loans,loading,error,refresh}=useLibraryData()
  const [failure,setFailure]=useState(''),[notice,setNotice]=useState('')
  const activeLoans=loans.filter(l=>!l.return_date)
  const submit=async e=>{e.preventDefault();setFailure('');setNotice('');const data=Object.fromEntries(new FormData(e.currentTarget).entries());data.book_id=Number(data.book_id);data.member_id=Number(data.member_id);try{await issueBook(data);setNotice('Book issued successfully. Due date is 14 days from the issue date.');e.currentTarget.reset();refresh()}catch(err){setFailure(errorText(err))}}
  const doReturn=async loan=>{if(!confirm(`Mark "${loan.book_title||'this book'}" as returned?`))return;try{const res=await returnBook(loan.id);setNotice(`Book returned successfully. Fine: ${money(res.data.fine)}`);refresh()}catch(e){setFailure(errorText(e))}}
  return <>
    <PageIntro title="Issue & return desk" description="Lend books to members and record returns. The standard loan period is 14 days."/>
    <Alert>{error||failure}</Alert>{notice&&<div className="alert success"><CheckCircle2 size={17}/>{notice}</div>}
    <div className="issue-layout"><section className="panel issue-form-panel"><div className="panel-heading"><div><h3>Issue a book</h3><p>Choose a reader and an available title.</p></div><ArrowLeftRight size={19}/></div>
      <form onSubmit={submit} className="stack-form"><label>Choose book<select name="book_id" required defaultValue=""><option value="" disabled>Select a book</option>{books.filter(b=>Number(b.copies_available)>0).map(b=><option key={b.id} value={b.id}>{b.title} — {b.author} ({b.copies_available} available)</option>)}</select></label><label>Choose member<select name="member_id" required defaultValue=""><option value="" disabled>Select a member</option>{members.map(m=><option key={m.id} value={m.id}>{m.name} — {m.email}</option>)}</select></label><div className="loan-info"><Clock3 size={17}/><span>Due date will be set automatically to <b>14 days</b> after issue.</span></div><button className="primary-btn full-btn" disabled={!books.some(b=>Number(b.copies_available)>0)||!members.length}><ArrowLeftRight size={17}/> Confirm issue</button></form>
    </section><section className="panel issue-summary"><div className="panel-heading"><div><h3>Currently on loan</h3><p>Books currently borrowed by members.</p></div><span className="count-badge">{activeLoans.length}</span></div><div className="loan-mini-list">{activeLoans.slice(0,4).map(l=><div className="loan-mini" key={l.id}><span className="mini-book"><BookOpen size={17}/></span><div><b>{l.book_title||`Book #${l.book}`}</b><small>{l.member_name||`Member #${l.member}`} · Due {dateText(l.due_date)}</small></div></div>)}{!activeLoans.length&&<EmptyState text="No books are currently on loan."/>}</div></section></div>
    <section className="panel loan-table-panel"><div className="panel-heading"><div><h3>Loan register</h3><p>Issue history and return actions.</p></div><span className="result-count">{loans.length} records</span></div><div className="table-wrap"><table><thead><tr><th>BOOK</th><th>MEMBER</th><th>ISSUE DATE</th><th>DUE DATE</th><th>STATUS / ACTION</th></tr></thead><tbody>{[...loans].reverse().map(l=><tr key={l.id}><td><b>{l.book_title||`Book #${l.book}`}</b></td><td>{l.member_name||`Member #${l.member}`}</td><td>{dateText(l.issue_date)}</td><td>{dateText(l.due_date)}</td><td>{l.return_date?<span className="status returned">Returned · {dateText(l.return_date)}</span>:<button className="small-action" onClick={()=>doReturn(l)}><RotateCcw size={14}/> Mark returned</button>}</td></tr>)}{!loans.length&&<tr><td colSpan="5"><EmptyState text="No loan records yet."/></td></tr>}</tbody></table></div></section>
  </>
}
function OverduePage() {
  const {overdue,loading,error,refresh}=useLibraryData()
  return <>
    <PageIntro title="Overdue books" description="A gentle reminder list of books whose due dates have passed." action={<button className="secondary-btn" onClick={refresh}><RotateCcw size={16}/> Refresh list</button>}/>
    <Alert>{error}</Alert><div className="overdue-banner"><div className="overdue-icon"><Clock3 size={22}/></div><div><b>{overdue.length} books need attention</b><p>Only books that have not been returned and are past their due date appear here.</p></div></div>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>BOOK</th><th>MEMBER</th><th>DUE DATE</th><th>DAYS OVERDUE</th><th>ESTIMATED FINE</th></tr></thead><tbody>{overdue.map(l=>{const days=Math.max(0,Math.floor((new Date().setHours(0,0,0,0)-new Date(`${l.due_date}T00:00:00`))/86400000));return <tr key={l.id}><td><b>{l.book_title||`Book #${l.book}`}</b></td><td>{l.member_name||`Member #${l.member}`}</td><td>{dateText(l.due_date)}</td><td><span className="days-late">{days} days</span></td><td><b className="fine-amount">{money(days*5)}</b></td></tr>})}{!overdue.length&&<tr><td colSpan="5"><EmptyState text={loading?'Loading overdue books...':'Wonderful! There are no overdue books right now.'}/></td></tr>}</tbody></table></div></section>
    <p className="fine-note"><IndianRupee size={15}/> Fine estimate uses ₹5 per overdue day, matching the current Django return calculation. The final fine is recorded when a book is returned.</p>
  </>
}

function AuthPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const form = Object.fromEntries(new FormData(e.currentTarget).entries())

    try {
      const response = isRegister
        ? await registerMember(form)
        : await loginUser(form)

      onLogin(response.data)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <main className="main-area">
        <div className="page-content">
          <div className="panel form-panel" style={{ maxWidth: '480px', margin: '60px auto' }}>
            <div className="form-heading">
              <div>
                <h2>GramPustaka</h2>
                <p className="muted">
                  {isRegister
                    ? 'Create your village library account.'
                    : 'Welcome back to your village library.'}
                </p>
              </div>
              <LibraryBig size={28}/>
            </div>

            <Alert>{error}</Alert>

            <form onSubmit={submit} className="stack-form">
              {isRegister && (
                <label>
                  Full name
                  <input
                    name="name"
                    required
                    placeholder="Enter your full name"
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  minLength="8"
                  placeholder="Enter your password"
                />
              </label>

              <button className="primary-btn full-btn" disabled={loading}>
                {loading
                  ? 'Please wait...'
                  : isRegister
                    ? 'Create account'
                    : 'Login'}
              </button>
            </form>

            <p style={{ marginTop: '20px', textAlign: 'center' }}>
              {isRegister
                ? 'Already have an account? '
                : "Don't have an account? "}

              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setError('')
                }}
              >
                {isRegister ? 'Login' : 'Register'}
              </button>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
function MemberApp({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('books')
  const [books, setBooks] = useState([])
  const [loans, setLoans] = useState([])
  const [fines, setFines] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError('')

    try {
      const [bookResponse, loanResponse, fineResponse] = await Promise.all([
        getBooks(),
        getMyLoans(),
        getMyFines()
      ])

      const bookData = bookResponse.data
      const loanData = loanResponse.data
      const fineData = fineResponse.data

      setBooks(bookData.results || bookData)
      setLoans(loanData.results || loanData)

      // Accept either a list or an object containing a fines list.
      setFines(
        Array.isArray(fineData)
          ? fineData
          : fineData.fines || fineData.results || fineData.loans || []
      )
    } catch (err) {
      setError(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const borrowBook = async (book) => {
    setError('')
    setNotice('')

    if (Number(book.copies_available) <= 0) {
      setError('This book is currently unavailable.')
      return
    }

    try {
      await issueBook({ book_id: book.id })
      setNotice(`"${book.title}" has been borrowed successfully.`)
      refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const requestFinePayment = async (loan) => {
    setError('')
    setNotice('')

    try {
      await payFine({
        loan_id: loan.id,
        amount: loan.fine,
        payment_method: 'CASH'
      })

      setNotice('Fine payment request submitted. Please contact the library admin to confirm payment.')
      refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const filteredBooks = books.filter(book =>
    `${book.title} ${book.author} ${book.category}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const activeLoans = loans.filter(loan => !loan.return_date)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <LibraryBig size={23}/>
          </div>
          <div>
            <strong>GramPustaka</strong>
            <span>VILLAGE LIBRARY</span>
          </div>
        </div>

        <div className="library-chip">
          <span className="online-dot"/> Member account
        </div>

        <p className="nav-caption">MEMBER MENU</p>

        <nav className="nav-list">
          <button
            className={`nav-link ${activeTab === 'books' ? 'active' : ''}`}
            onClick={() => setActiveTab('books')}
          >
            <BookOpen size={18}/>
            <span>Browse Books</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'loans' ? 'active' : ''}`}
            onClick={() => setActiveTab('loans')}
          >
            <ArrowLeftRight size={18}/>
            <span>My Borrowed Books</span>
          </button>

          <button
            className={`nav-link ${activeTab === 'fines' ? 'active' : ''}`}
            onClick={() => setActiveTab('fines')}
          >
            <IndianRupee size={18}/>
            <span>My Fines</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <span className="avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'M'}
          </span>
          <div>
            <b>{user?.name || 'Library Member'}</b>
            <small>Member account</small>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <div>
              <div className="eyebrow">GRAMPUSTAKA / MEMBER</div>
              <h1>
                {activeTab === 'books'
                  ? 'Browse Books'
                  : activeTab === 'loans'
                    ? 'My Borrowed Books'
                    : 'My Fines'}
              </h1>
            </div>
          </div>

          <div className="topbar-right">
            <div className="top-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <button className="secondary-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="page-content">
          <PageIntro
            title={`Welcome, ${user?.name || 'Reader'}!`}
            description="Explore books and manage your library activity."
            action={
              <button className="secondary-btn" onClick={refresh}>
                <RotateCcw size={16}/> Refresh
              </button>
            }
          />

          <Alert>{error}</Alert>

          {notice && (
            <div className="alert success">
              <CheckCircle2 size={17}/>
              {notice}
            </div>
          )}

          {activeTab === 'books' && (
            <>
              <div className="toolbar">
                <div className="search-box">
                  <Search size={17}/>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search books or authors..."
                  />
                </div>
                <span className="result-count">
                  {filteredBooks.length} books
                </span>
              </div>

              <section className="panel">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>BOOK TITLE</th>
                        <th>AUTHOR</th>
                        <th>CATEGORY</th>
                        <th>AVAILABLE</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBooks.map(book => (
                        <tr key={book.id}>
                          <td><b>{book.title}</b></td>
                          <td>{book.author}</td>
                          <td>
                            <span className="category-pill">
                              {book.category}
                            </span>
                          </td>
                          <td>{book.copies_available}</td>
                          <td>
                            <button
                              className="small-action"
                              disabled={Number(book.copies_available) <= 0}
                              onClick={() => borrowBook(book)}
                            >
                              Borrow
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!filteredBooks.length && (
                        <tr>
                          <td colSpan="5">
                            <EmptyState text={
                              loading ? 'Loading books...' : 'No books found.'
                            }/>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === 'loans' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>My borrowed books</h3>
                  <p>View your current loans and borrowing history.</p>
                </div>
                <span className="count-badge">{activeLoans.length}</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>BOOK</th>
                      <th>ISSUE DATE</th>
                      <th>DUE DATE</th>
                      <th>RETURN DATE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map(loan => (
                      <tr key={loan.id}>
                        <td>
                          <b>{loan.book_title || `Book #${loan.book}`}</b>
                        </td>
                        <td>{dateText(loan.issue_date)}</td>
                        <td>{dateText(loan.due_date)}</td>
                        <td>{dateText(loan.return_date)}</td>
                        <td>
                          <span className={`status ${loan.return_date ? 'returned' : 'active'}`}>
                            {loan.return_date ? 'Returned' : 'On loan'}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {!loans.length && (
                      <tr>
                        <td colSpan="5">
                          <EmptyState text={
                            loading ? 'Loading your loans...' : 'You have no borrowing history yet.'
                          }/>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'fines' && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>My fines</h3>
                  <p>Check outstanding fines for your returned books.</p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>LOAN ID</th>
                      <th>BOOK</th>
                      <th>FINE</th>
                      <th>PAYMENT STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fines.map(item => {
                      const loan = item.loan_details || item.loan || item
                      const loanId = typeof item.loan === 'object'
                        ? item.loan.id
                        : item.loan_id || item.id

                      const amount = Number(
                        item.outstanding_amount ?? item.amount ?? item.fine ?? loan.fine ?? 0
                      )

                      return (
                        <tr key={item.id || loanId}>
                          <td>{loanId || '—'}</td>
                          <td>{loan.book_title || item.book_title || '—'}</td>
                          <td>{money(amount)}</td>
                          <td>
                            {item.status || (amount > 0 ? 'Outstanding' : 'Paid')}
                          </td>
                          <td>
                            {amount > 0 && loanId && (
                              <button
                                className="small-action"
                                onClick={() => requestFinePayment({
                                  id: loanId,
                                  fine: amount
                                })}
                              >
                                Request payment
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}

                    {!fines.length && (
                      <tr>
                        <td colSpan="5">
                          <EmptyState text={
                            loading ? 'Loading fine details...' : 'No fine records found.'
                          }/>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <footer className="footer">
          <span>© {new Date().getFullYear()} GramPustaka Village Library</span>
          <span>Read • Learn • Grow <Leaf size={13}/></span>
        </footer>
      </main>
    </div>
  )
}
function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('library_user')) || null
    } catch {
      return null
    }
  })

  const handleLogin = (data) => {
    localStorage.setItem('token', data.token)

    const userData = {
      role: data.role,
      name: data.name,
      email: data.email,
      member_id: data.member_id
    }

    localStorage.setItem('library_user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch (err) {
      console.error('Logout request failed:', err)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('library_user')
      setUser(null)
    }
  }

  if (!localStorage.getItem('token') || !user) {
    return <AuthPage onLogin={handleLogin}/>
  }

  if (user.role === 'admin') {
    return <AdminApp user={user} onLogout={handleLogout}/>
  }

  return <MemberApp user={user} onLogout={handleLogout}/>
}

export default App