import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const elements = {
  customerLogin: document.getElementById("customer-login"),
  employeeLogin: document.getElementById("employee-login"),
  employeeRole: document.getElementById("employee-role"),
  printBarcode: document.getElementById("print-barcode"),
  barcodeSvg: document.getElementById("barcode"),
  checkinRollId: document.getElementById("checkin-roll-id"),
  createRoll: document.getElementById("create-roll"),
  sendApproval: document.getElementById("send-approval"),
  customerQueue: document.getElementById("customer-queue"),
  approveRoll: document.getElementById("approve-roll"),
  rejectIncorrect: document.getElementById("reject-incorrect"),
  rejectScrap: document.getElementById("reject-scrap"),
  grindingNew: document.getElementById("grinding-new"),
  grindingDone: document.getElementById("grinding-done"),
  flutingAccept: document.getElementById("fluting-accept"),
  flutingDone: document.getElementById("fluting-done"),
  frostingAccept: document.getElementById("frosting-accept"),
  frostingDone: document.getElementById("frosting-done"),
  cratingReady: document.getElementById("crating-ready"),
  deliveryDone: document.getElementById("delivery-done"),
  adminTrack: document.getElementById("admin-track"),
  adminRollDetails: document.getElementById("admin-roll-details"),
  controllerStatus: document.getElementById("controller-status"),
  controllerLookupBtn: document.getElementById("controller-lookup-btn"),
  metricAverage: document.getElementById("metric-average"),
  metricLongest: document.getElementById("metric-longest"),
  customerRollList: document.getElementById("customer-roll-list"),
  adminCreateCustomer: document.getElementById("admin-create-customer"),
  adminCreateEmployee: document.getElementById("admin-create-employee"),
};

const page = document.body?.dataset.page;

const showToast = (message) => {
  window.alert(message);
};

const fetchQueueCount = async () => {
  const { error, count } = await supabase
    .from("roll_queue")
    .select("queue_position", { count: "exact", head: true });

  if (error) {
    console.error(error);
    return 0;
  }

  return count ?? 0;
};

const fetchRollById = async (rollId) => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id,status,mill_name,rejected_note")
    .eq("roll_id", rollId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const fetchMetrics = async () => {
  const { data: metrics } = await supabase
    .from("roll_turnaround_metrics")
    .select("avg_turnaround_hours,max_turnaround_hours")
    .single();

  const { data: longest } = await supabase
    .from("longest_turnaround_roll")
    .select("roll_id,mill_name,turnaround_hours")
    .single();

  return { metrics, longest };
};

const fetchCustomerRolls = async () => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id,status")
    .order("checked_in_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

const handleLogin = async (email, password) => {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    showToast(error.message);
    return false;
  }
  showToast("Logged in. Loading dashboard...");
  return true;
};

elements.customerLogin?.addEventListener("click", async () => {
  const email = document.getElementById("customer-email").value;
  const password = document.getElementById("customer-password").value;
  const ok = await handleLogin(email, password);
  if (ok) {
    window.location.href = "customer.html";
  }
});

elements.employeeLogin?.addEventListener("click", async () => {
  const email = document.getElementById("employee-email").value;
  const password = document.getElementById("employee-password").value;
  const role = elements.employeeRole.value;
  showToast(`Logging in as ${role}.`);
  const ok = await handleLogin(email, password);
  if (ok) {
    window.location.href = `${role}.html`;
  }
});

// Roll check-in

elements.printBarcode?.addEventListener("click", () => {
  const rollId = elements.checkinRollId.value.trim();
  if (!rollId) {
    showToast("Enter a Roll ID to print a barcode.");
    return;
  }
  JsBarcode(elements.barcodeSvg, rollId, {
    format: "CODE128",
    displayValue: true,
  });
});

elements.createRoll?.addEventListener("click", async () => {
  const payload = {
    roll_id: elements.checkinRollId.value.trim(),
    mill_name: document.getElementById("checkin-mill").value.trim(),
    date_received: document.getElementById("checkin-date").value,
    fluting_required: document.getElementById("checkin-fluting").checked,
    frosting_required: document.getElementById("checkin-frosting").checked,
  };

  const { error } = await supabase.from("rolls").insert(payload);
  if (error) {
    showToast(error.message);
    return;
  }
  showToast("Roll created in CHECKED_IN status.");
});

// Controller approval request (email should be triggered from Edge Function)

elements.sendApproval?.addEventListener("click", () => {
  showToast("Approval request queued. Trigger your email function here.");
});

// Customer approvals

elements.approveRoll?.addEventListener("click", () => {
  showToast("Roll approved. Update status to APPROVED.");
});

elements.rejectIncorrect?.addEventListener("click", () => {
  showToast("Roll rejected for incorrect info. Capture note + set REJECTED.");
});

elements.rejectScrap?.addEventListener("click", () => {
  showToast("Scrap roll confirmed twice. Set status to SCRAPPED.");
});

// Queue actions

elements.grindingNew?.addEventListener("click", () => {
  showToast("Scan barcode to start GRINDING. Validate FIFO + priority.");
});

elements.grindingDone?.addEventListener("click", () => {
  showToast("Scan barcode to set GRINDING_DONE.");
});

elements.flutingAccept?.addEventListener("click", () => {
  showToast("Fluting specs accepted. Set status to FLUTING.");
});

elements.flutingDone?.addEventListener("click", () => {
  showToast("Scan barcode to set FLUTING_DONE.");
});

elements.frostingAccept?.addEventListener("click", () => {
  showToast("Frosting specs accepted. Set status to FROSTING.");
});

elements.frostingDone?.addEventListener("click", () => {
  showToast("Scan barcode to set FROSTING_DONE.");
});

// Crating & delivery

elements.cratingReady?.addEventListener("click", () => {
  showToast("Mark READY_FOR_DELIVERY and send email notification.");
});

elements.deliveryDone?.addEventListener("click", () => {
  showToast("Mark DELIVERED.");
});

// Admin tracking

elements.adminTrack?.addEventListener("click", async () => {
  const rollId = document.getElementById("admin-roll-id").value.trim();
  if (!rollId) {
    showToast("Enter a Roll ID.");
    return;
  }
  try {
    const data = await fetchRollById(rollId);
    if (data.status === "SCRAPPED") {
      elements.adminRollDetails.textContent = `Roll ${data.roll_id} is SCRAPPED for ${data.mill_name}.`;
      return;
    }
    elements.adminRollDetails.textContent = `Roll ${data.roll_id} is ${data.status} for ${data.mill_name}.`;
  } catch (error) {
    showToast(error.message);
  }
});

elements.controllerLookupBtn?.addEventListener("click", async () => {
  const rollId = document.getElementById("controller-lookup").value.trim();
  if (!rollId) {
    showToast("Enter a Roll ID.");
    return;
  }
  try {
    const data = await fetchRollById(rollId);
    if (data.status === "SCRAPPED") {
      elements.controllerStatus.textContent = `SCRAPPED: Roll ${data.roll_id} for ${data.mill_name}.`;
      return;
    }
    if (data.status === "REJECTED") {
      elements.controllerStatus.textContent = `REJECTED: ${data.rejected_note ?? "No note provided"}.`;
      return;
    }
    elements.controllerStatus.textContent = `Roll ${data.roll_id} is ${data.status}.`;
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminCreateCustomer?.addEventListener("click", async () => {
  const payload = {
    mill_name: document.getElementById("admin-customer-mill").value.trim(),
    email: document.getElementById("admin-customer-email").value.trim(),
    auth_user_id: document.getElementById("admin-customer-auth").value.trim() || null,
  };
  if (!payload.mill_name || !payload.email) {
    showToast("Mill Name and email are required.");
    return;
  }
  const { error } = await supabase.from("customers").insert(payload);
  if (error) {
    showToast(error.message);
    return;
  }
  showToast("Customer profile created.");
});

elements.adminCreateEmployee?.addEventListener("click", async () => {
  const payload = {
    role: document.getElementById("admin-employee-role").value,
    display_name: document.getElementById("admin-employee-name").value.trim(),
    auth_user_id: document.getElementById("admin-employee-auth").value.trim() || null,
  };
  if (!payload.role || !payload.auth_user_id) {
    showToast("Role and Auth User ID are required.");
    return;
  }
  const { error } = await supabase.from("employees").insert(payload);
  if (error) {
    showToast(error.message);
    return;
  }
  showToast("Employee profile created.");
});

const init = async () => {
  if (page === "customer" && elements.customerQueue) {
    const queueCount = await fetchQueueCount();
    elements.customerQueue.textContent = queueCount;
  }

  if (page === "customer" && elements.customerRollList) {
    try {
      const rolls = await fetchCustomerRolls();
      elements.customerRollList.innerHTML = "";
      rolls.forEach((roll) => {
        const item = document.createElement("li");
        item.textContent = `${roll.roll_id} — ${roll.status}`;
        elements.customerRollList.appendChild(item);
      });
    } catch (error) {
      showToast(error.message);
    }
  }

  if (page === "admin" && elements.metricAverage && elements.metricLongest) {
    const { metrics, longest } = await fetchMetrics();
    if (metrics) {
      elements.metricAverage.textContent = `${metrics.avg_turnaround_hours?.toFixed(1) ?? "--"} hrs`;
      elements.metricLongest.textContent = `${metrics.max_turnaround_hours?.toFixed(1) ?? "--"} hrs`;
    }
    if (longest && longest.roll_id) {
      elements.metricLongest.textContent = `${longest.roll_id} (${longest.mill_name}) - ${longest.turnaround_hours?.toFixed(1)} hrs`;
    }
  }
};

init();
