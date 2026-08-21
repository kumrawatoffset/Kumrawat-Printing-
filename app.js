document.getElementById("orderForm")?.addEventListener("submit", async e => {
 e.preventDefault(); const msg=document.getElementById("msg"); msg.textContent="Submitting...";
 try { const r=await fetch("/api/orders",{method:"POST",body:new FormData(e.target)}); const d=await r.json();
 if(!r.ok) throw new Error(d.error||"Could not submit");
 msg.innerHTML=`<strong>Order submitted successfully!</strong><br>Your Order Number: <b>${d.orderNo}</b><br><a href="/track.html?order=${encodeURIComponent(d.orderNo)}">Track this order</a>`;
 e.target.reset();
 } catch(err){msg.textContent=err.message;}
});