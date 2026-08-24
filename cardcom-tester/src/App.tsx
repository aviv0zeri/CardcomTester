import { useState } from 'react'

/**
 * Outer payment shell / test harness.
 * Creates a Cardcom Low Profile session via the shared Node API and embeds
 * Cardcom's hosted page. The checkout UI inside the iframe is Cardcom's
 * static HTML/CSS — do not manipulate the iframe document from React.
 */
function App() {
  const [status, setStatus] = useState('ready');
  const [paymentUrl, setPaymentUrl] = useState('');
  const isLoading = status === 'Loading...';

  const handleTestPayment = async () => {
    setStatus('Loading...');

    try {
      const response = await fetch(
        'http://localhost:3000/payment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: 10,
            profileId: 'tester'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const data = await response.json();
      console.log(data);

      if (data.Url) {
        setPaymentUrl(data.Url);
      }

      setStatus('Success');
    } catch (error) {
      console.log(error);
      setStatus('Failed');
    }
  }

  return (
    <main className={paymentUrl ? 'app app--checkout' : 'app'}>
      {paymentUrl ? (
        <>
          <header className="topbar">
            <h1>CardCom Tester</h1>
            <p className={`status status--${status === 'Failed' ? 'failed' : 'ok'}`}>
              Status: {status}
            </p>
          </header>
          <div className="payment-frame-wrap">
            <iframe
              className="payment-frame"
              src={paymentUrl}
              title="CardCom payment"
            />
          </div>
        </>
      ) : (
        <section className="start">
          <div className="cta">
            <h1>CardCom Tester</h1>
            <p className="cta-copy">
              Run a ₪10 test charge and open the CardCom payment page.
            </p>
            <button
              className="cta-button"
              onClick={handleTestPayment}
              disabled={isLoading}
            >
              {isLoading ? 'Starting payment…' : 'Test Payment'}
            </button>
            <p className={`status status--${status === 'Failed' ? 'failed' : 'muted'}`}>
              Status: {status}
            </p>
          </div>
        </section>
      )}
    </main>
  )
}

export default App;
