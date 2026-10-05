/* BUD N' BUDDER — unified Stripe / Venmo / Zelle payment page */
(function () {
  'use strict';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const API_BASE = window.BNB_API_BASE_URL || 'http://https://budnbudder-backend.onrender.com/api';
  let STRIPE_PUBLISHABLE_KEY = window.BNB_STRIPE_PUBLISHABLE_KEY || '';
  const state = { stripe: null, elements: null, paymentElement: null, submitting: false };

  function money(value) { const n = Number(value); return Number.isFinite(n) ? '$' + n.toFixed(2) : '$0.00'; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function session(key) { try { return sessionStorage.getItem(key); } catch (_) { return null; } }
  function showEmptyState() { $('#paymentEmpty').hidden = false; $('#paymentContent').hidden = true; }
  function showBanner(message) { const b=$('#paymentErrorBanner'), t=$('#paymentErrorBannerText'); if(t)t.textContent=message; if(b)b.hidden=false; }
  function hideBanner() { const b=$('#paymentErrorBanner'); if(b)b.hidden=true; }
  function showProcessing() { $('#paymentProcessing')?.classList.add('is-active'); }
  function hideProcessing() { $('#paymentProcessing')?.classList.remove('is-active'); }
  function setPayLoading(loading) { const b=$('#payBtn'); if(!b)return; b.disabled=loading; b.classList.toggle('is-loading',loading); }

  async function loadPaymentConfig() {
    if (STRIPE_PUBLISHABLE_KEY) return;
    const response = await fetch(API_BASE + '/payment-config', { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Unable to load payment configuration.');
    STRIPE_PUBLISHABLE_KEY = data.stripePublishableKey || '';
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(API_BASE + path, { credentials: 'include', ...options, headers: { 'Content-Type':'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Request failed.');
    return data;
  }

  function renderOrderSummary(summary) {
    if (!summary) return;
    const itemsEl=$('#summaryItems'), countEl=$('#summaryCount'), subtotalEl=$('#summarySubtotal'), taxEl=$('#summaryTax'), totalEl=$('#summaryTotal');
    const items=Array.isArray(summary.items)?summary.items:[]; let count=0;
    if(itemsEl) itemsEl.innerHTML=items.map(item=>{ count+=Number(item.quantity||0); const image=item.image?`<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name||'')}" loading="lazy">`:'<div class="media-frame__placeholder" aria-hidden="true"></div>'; return `<div class="checkout-summary-item"><div class="checkout-summary-item__thumb">${image}<span class="checkout-summary-item__qty">${item.quantity}</span></div><div class="checkout-summary-item__info"><span class="checkout-summary-item__name">${escapeHtml(item.name||'Product')}</span></div><span class="checkout-summary-item__price">${money(Number(item.price||0)*Number(item.quantity||0))}</span></div>`; }).join('');
    if(countEl)countEl.textContent=count; if(subtotalEl)subtotalEl.textContent=money(summary.subtotal);
    if(taxEl)taxEl.textContent=money(Number(summary.tax||0)+Number(summary.shipping||0)); if(totalEl)totalEl.textContent=money(summary.total);
  }

  async function loadStripeScript() {
    if (window.Stripe) return window.Stripe;
    await new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src='https://js.stripe.com/v3/'; s.onload=()=>resolve(); s.onerror=()=>reject(new Error('Unable to load Stripe.js.')); document.head.appendChild(s); });
    return window.Stripe;
  }

  async function initStripe() {
    if(!STRIPE_PUBLISHABLE_KEY) throw new Error('Stripe is not configured on the server.');
    const StripeConstructor=await loadStripeScript(); state.stripe=StripeConstructor(STRIPE_PUBLISHABLE_KEY);
    const clientSecret=session('bnb_checkout_client_secret');
    if(!clientSecret) throw new Error('Stripe payment session is missing. Please return to checkout.');
    state.elements=state.stripe.elements({clientSecret}); state.paymentElement=state.elements.create('payment',{layout:'tabs'}); state.paymentElement.mount('#payment-element');
    state.paymentElement.on('change',e=>{const el=$('#paymentError'); if(!el)return; el.textContent=e.error?.message||''; el.hidden=!e.error;});
    const amount=session('bnb_checkout_amount'); const label=$('#payBtn .btn-label'); if(label)label.textContent=`Pay ${money(amount)}`;
    $('#payBtn').addEventListener('click', async()=>{
      if(state.submitting)return; state.submitting=true; showProcessing(); setPayLoading(true); hideBanner();
      try { const result=await state.stripe.confirmPayment({elements:state.elements,confirmParams:{return_url:window.location.origin+'/success.html'},redirect:'if_required'}); if(result.error)throw new Error(result.error.message||'Payment could not be completed.'); const pi=result.paymentIntent; if(pi&&(pi.status==='succeeded'||pi.status==='processing')){ window.location.href='success.html'; return; } throw new Error('Payment was not completed.'); }
      catch(e){console.error(e);hideProcessing();setPayLoading(false);state.submitting=false;showBanner(e.message||'Payment failed.');}
    });
  }

  function loadPayPalSdk(environment) {
    if(window.paypal?.createInstance) return Promise.resolve(window.paypal);
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script'); script.async=true; script.src=(environment==='production'?'https://www.paypal.com/web-sdk/v6/core':'https://www.sandbox.paypal.com/web-sdk/v6/core');
      script.onload=()=>window.paypal?.createInstance?resolve(window.paypal):reject(new Error('PayPal SDK loaded but is unavailable.'));
      script.onerror=()=>reject(new Error('Unable to load Venmo.')); document.head.appendChild(script);
    });
  }

  async function initVenmo() {
    const clientId=session('bnb_paypal_client_id'); const environment=session('bnb_paypal_environment')||'sandbox'; const paypalOrderId=session('bnb_paypal_order_id');
    if(!clientId||!paypalOrderId)throw new Error('Venmo payment session is incomplete.');
    const paypalNamespace=await loadPayPalSdk(environment);
    const sdk=await paypalNamespace.createInstance({clientId,components:['venmo-payments'],pageType:'checkout'});
    const methods=await sdk.findEligibleMethods({currencyCode:'USD'});
    if(!methods.isEligible('venmo')) throw new Error('Venmo is not available for this customer or device.');
    const button=$('#venmo-button'); if(!button)throw new Error('Venmo button is missing.'); button.hidden=false;
    const venmoSession=sdk.createVenmoOneTimePaymentSession({
      async onApprove(data){
        showProcessing();
        try { const result=await apiRequest('/capture-venmo-order',{method:'POST',body:JSON.stringify({paypalOrderId:data.orderId||paypalOrderId})}); if(!result.success)throw new Error(result.message||'Venmo capture failed.'); window.location.href='success.html'; }
        catch(e){hideProcessing();state.submitting=false;showBanner(e.message||'Venmo payment could not be completed.');}
      },
      onCancel(){ state.submitting=false; showBanner('Venmo payment was cancelled. You can try again.'); },
      onError(error){ state.submitting=false; console.error('Venmo error:',error); showBanner('Venmo payment could not be completed. Please try again.'); }
    });
    button.addEventListener('click',async()=>{ if(state.submitting)return; state.submitting=true; hideBanner(); try { await venmoSession.start({presentationMode:'auto'},Promise.resolve({orderId:paypalOrderId})); } catch(e){ state.submitting=false; console.error(e); showBanner(e.message||'Unable to start Venmo.'); } });
  }

  function initZelle() {
    const recipient=session('bnb_zelle_recipient'); const instructions=session('bnb_zelle_instructions'); const amount=session('bnb_checkout_amount');
    const orderId=session('bnb_last_order_id'); const orderNumber=session('bnb_last_order_number'); const transactionId=session('bnb_payment_transaction_id');
    if(!recipient || !orderId || !transactionId)throw new Error('Zelle payment session is incomplete.');
    const amountText=money(amount);
    const memo=orderNumber || orderId;
    $('#zelleAmount').textContent=amountText;
    $('#zelleRecipient').textContent=recipient;
    $('#zelleMemo').textContent=memo;
    $('#zelleInstructions').textContent=instructions||`Open your bank's Zelle feature and send exactly ${amountText}. Put ${memo} in the payment memo/note so the store can identify your order.`;

    async function copyZelleValue(value, button, defaultLabel) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(String(value));
        } else {
          const field=document.createElement('textarea'); field.value=String(value); field.setAttribute('readonly',''); field.style.position='fixed'; field.style.opacity='0'; document.body.appendChild(field); field.select();
          const copied=document.execCommand('copy'); field.remove(); if(!copied) throw new Error('Copy unavailable');
        }
        button.textContent='Copied!';
        window.setTimeout(()=>{button.textContent=defaultLabel;},1600);
      } catch (_) {
        showBanner('Could not copy automatically. Please select and copy the displayed value.');
      }
    }
    $('#zelleCopyAmount').addEventListener('click',e=>copyZelleValue(amountText,e.currentTarget,'Copy amount'));
    $('#zelleCopyRecipient').addEventListener('click',e=>copyZelleValue(recipient,e.currentTarget,'Copy number'));
    $('#zelleCopyMemo').addEventListener('click',e=>copyZelleValue(memo,e.currentTarget,'Copy memo'));
    $('#zelleDoneBtn').addEventListener('click',async()=>{
      if(state.submitting)return;
      state.submitting=true; showProcessing();
      try {
        const result=await apiRequest('/claim-zelle-payment',{method:'POST',body:JSON.stringify({orderId,transactionId})});
        if(!result.success)throw new Error(result.message||'Unable to record Zelle payment.');
        hideProcessing();
        state.submitting=false;
        const button=$('#zelleDoneBtn');
        if(button){ button.disabled=true; button.textContent='Payment Notification Recorded'; }
        const success=$('#zelleClaimSuccess');
        if(success) success.hidden=false;
      } catch(e) {
        state.submitting=false; hideProcessing(); showBanner(e.message||'Unable to record Zelle payment.');
      }
    });
  }

  async function initialize() {
    try { await loadPaymentConfig(); } catch (e) { console.warn('Payment config load failed:', e); }
    const method=(session('bnb_payment_method')||'Stripe').toLowerCase();
    let summary=null; try { summary=JSON.parse(session('bnb_checkout_summary')||'null'); } catch(_){ }
    if(!session('bnb_last_order_id')){showEmptyState();return;}
    renderOrderSummary(summary);
    $('#stripePaymentSection').hidden=method!=='stripe'; $('#venmoPaymentSection').hidden=method!=='venmo'; $('#zellePaymentSection').hidden=method!=='zelle';
    try { if(method==='stripe') await initStripe(); else if(method==='venmo') await initVenmo(); else if(method==='zelle') initZelle(); else throw new Error('Unsupported payment method.'); }
    catch(e){console.error('Payment initialization failed:',e);showBanner(e.message||'Unable to load payment.');}
  }

  document.addEventListener('partials:loaded',initialize,{once:true});
})();
