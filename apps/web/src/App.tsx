import "./entry.css";

export function App() {
  return (
    <main className="entry">
      <h1 className="type-headline-large">CloudPilot</h1>
      <p className="type-body-large">
        A semester project for AI-assisted cloud VM rental.
      </p>
      <details className="entry-workflow">
        <summary className="type-title-medium">How the first demo will work</summary>
        <ol className="type-body-large">
          <li>Sign up, complete onboarding, and describe the VM you need in chat.</li>
          <li>Review the offer calculated from provider rules and choose whether to accept it.</li>
          <li>Receive an invoice and make a simulated payment in CloudPilot.</li>
          <li>Get access once the payment is verified and the simulated VM is ready.</li>
        </ol>
      </details>
    </main>
  );
}
