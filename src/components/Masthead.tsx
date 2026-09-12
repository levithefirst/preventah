export default function Masthead({ subtitle }: { subtitle?: string }) {
  return (
    <header className="masthead">
      <div className="mark" aria-hidden="true">
        P
      </div>
      <div className="masthead-text">
        <h1>Preventah</h1>
        <span className="faint">
          {subtitle ?? 'Prevention you actually stick to'}
        </span>
      </div>
    </header>
  );
}
