import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://mancjsrbmzgrvytenxvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DRmpAmFFMNmAOPM0ZglN7g_-EHX5jNd";

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
  grindingQueue: document.getElementById("grinding-queue"),
  flutingQueue: document.getElementById("fluting-queue"),
  frostingQueue: document.getElementById("frosting-queue"),
};

const page = document.body?.dataset.page;

const STAGE_STATUS = {
  grinding: ["APPROVED", "GRINDING"],
  fluting: ["GRINDING_DONE", "FLUTING"],
  frosting: ["GRINDING_DONE", "FROSTING"],
};

const showToast = (message) => {
  window.alert(message);
};

const sortQueue = (rows) =>
  [...rows].sort((a, b) => {
    const priorityA = a.priority === "A" ? 0 : 1;
    const priorityB = b.priority === "A" ? 0 : 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime();
  });

const fetchQueueCount = async () => {
  const { data, error } = await supabase
    .from("rolls")
    .select("id")
    .in("status", ["APPROVED", "GRINDING", "GRINDING_DONE", "FLUTING", "FROSTING", "FLUTING_DONE", "FROSTING_DONE", "CRATING_CHECKING", "READY_FOR_DELIVERY"]);

  if (error) {
    console.error(error);
    return 0;
  }

  return data?.length ?? 0;
};

const fetchRollById = async (rollId) => {
  const { data, error } = await supabase
    .from("rolls")
    .select("id,roll_id,status,mill_name,rejected_note,fluting_required,frosting_required,priority,checked_in_at,fluting_specs,frosting_specs")
    .eq("roll_id", rollId)
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const updateRoll = async (rollId, patch) => {
  const { data, error } = await supabase
    .from("rolls")
    .update(patch)
    .eq("roll_id", rollId)
    .select("roll_id,status")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const fetchStageQueue = async (statuses) => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id,status,priority,checked_in_at")
    .in("status", statuses);

  if (error) {
    throw error;
  }

  return sortQueue(data ?? []);
};

const renderQueue = async (statuses, target) => {
  if (!target) return;
  try {
    const queue = await fetchStageQueue(statuses);
    target.innerHTML = "";
    if (!queue.length) {
      const li = document.createElement("li");
      li.textContent = "No rolls in queue.";
      target.appendChild(li);
      return;
    }
    queue.forEach((roll, idx) => {
      const li = document.createElement("li");
      li.textContent = `${idx + 1}. ${roll.roll_id} — Priority ${roll.priority ?? "B"} — ${roll.status}`;
      target.appendChild(li);
    });
  } catch (error) {
    showToast(error.message);
  }
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

const requireNextQueueRoll = async (rollId, queueStatuses, expectedStatus) => {
  const queue = await fetchStageQueue(queueStatuses);
  if (!queue.length) {
    throw new Error("No rolls are currently eligible in this queue.");
  }

  const next = queue[0];
  if (next.roll_id !== rollId) {
    throw new Error(`Roll ${rollId} is not next. Next eligible is ${next.roll_id}.`);
  }

  const current = await fetchRollById(rollId);
  if (current.status !== expectedStatus) {
    throw new Error(`Roll ${rollId} must be ${expectedStatus} to start this stage.`);
  }

  return current;
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
    status: "CHECKED_IN",
  };

  const { error } = await supabase.from("rolls").insert(payload);
  if (error) {
    showToast(error.message);
    return;
  }
  showToast("Roll created in CHECKED_IN status.");
});

// Controller

elements.sendApproval?.addEventListener("click", async () => {
  const rollId = document.getElementById("controller-scan").value.trim();
  if (!rollId) {
    showToast("Scan a roll barcode first.");
    return;
  }

  const patch = {
    controller_notes: document.getElementById("controller-notes").value.trim() || null,
    diameter: Number(document.getElementById("controller-diameter").value) || null,
    visible_cracks: document.getElementById("controller-cracks").checked,
    cracks_notes: document.getElementById("controller-crack-notes").value.trim() || null,
    price_quote: Number(document.getElementById("controller-quote").value) || null,
    fluting_specs: document.getElementById("controller-fluting").value.trim() || null,
    frosting_specs: document.getElementById("controller-frosting").value.trim() || null,
    status: "AWAITING_CUSTOMER_APPROVAL",
  };

  try {
    await updateRoll(rollId, patch);
    showToast("Roll moved to AWAITING_CUSTOMER_APPROVAL. Send email via Edge Function.");
  } catch (error) {
    showToast(error.message);
  }
});

// Customer approvals

elements.approveRoll?.addEventListener("click", async () => {
  const rollId = document.getElementById("customer-roll-id")?.value.trim();
  const priority = document.getElementById("customer-priority")?.value;
  if (!rollId || !priority) {
    showToast("Roll ID and priority are required.");
    return;
  }
  try {
    const current = await fetchRollById(rollId);
    if (current.status !== "AWAITING_CUSTOMER_APPROVAL") {
      throw new Error("Roll is not awaiting customer approval.");
    }
    await updateRoll(rollId, { priority, status: "APPROVED", rejected_note: null, approved_at: new Date().toISOString() });
    showToast("Roll approved and sent to production queue.");
    if (page === "customer") {
      init();
    }
  } catch (error) {
    showToast(error.message);
  }
});

elements.rejectIncorrect?.addEventListener("click", async () => {
  const rollId = document.getElementById("customer-roll-id")?.value.trim();
  const note = document.getElementById("customer-reject-note")?.value.trim();
  if (!rollId || !note) {
    showToast("Roll ID and rejection note are required.");
    return;
  }

  try {
    await updateRoll(rollId, { status: "REJECTED", rejected_note: note });
    showToast("Roll moved to REJECTED and returned to controller.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.rejectScrap?.addEventListener("click", async () => {
  const rollId = document.getElementById("customer-roll-id")?.value.trim();
  if (!rollId) {
    showToast("Roll ID is required.");
    return;
  }

  const firstConfirm = window.confirm("Are you sure you want to SCRAP this roll?");
  if (!firstConfirm) return;
  const secondConfirm = window.confirm("Final confirmation: this is permanent. Scrap roll?");
  if (!secondConfirm) return;

  try {
    await updateRoll(rollId, { status: "SCRAPPED", scrapped_at: new Date().toISOString() });
    showToast("Roll status set to SCRAPPED (final).");
  } catch (error) {
    showToast(error.message);
  }
});

// Queue actions

elements.grindingNew?.addEventListener("click", async () => {
  const rollId = document.getElementById("grinding-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }

  try {
    await requireNextQueueRoll(rollId, ["APPROVED"], "APPROVED");
    await updateRoll(rollId, { status: "GRINDING" });
    showToast("Roll checked in at GRINDING.");
    renderQueue(STAGE_STATUS.grinding, elements.grindingQueue);
  } catch (error) {
    showToast(error.message);
  }
});

elements.grindingDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("grinding-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }

  try {
    const roll = await fetchRollById(rollId);
    if (roll.status !== "GRINDING") {
      throw new Error("Roll must be in GRINDING before marking done.");
    }
    await updateRoll(rollId, { status: "GRINDING_DONE" });
    showToast("Roll moved to GRINDING_DONE.");
    renderQueue(STAGE_STATUS.grinding, elements.grindingQueue);
  } catch (error) {
    showToast(error.message);
  }
});

elements.flutingAccept?.addEventListener("click", async () => {
  const rollId = document.getElementById("fluting-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }

  try {
    await requireNextQueueRoll(rollId, ["GRINDING_DONE"], "GRINDING_DONE");
    const roll = await fetchRollById(rollId);
    if (!roll.fluting_required) {
      throw new Error("This roll does not require fluting.");
    }
    await updateRoll(rollId, { status: "FLUTING" });
    showToast("Fluting specs accepted. Roll moved to FLUTING.");
    renderQueue(STAGE_STATUS.fluting, elements.flutingQueue);
  } catch (error) {
    showToast(error.message);
  }
});

elements.flutingDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("fluting-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }

  try {
    const roll = await fetchRollById(rollId);
    if (roll.status !== "FLUTING") {
      throw new Error("Roll must be FLUTING before done.");
    }
    await updateRoll(rollId, { status: "FLUTING_DONE" });
    showToast("Roll moved to FLUTING_DONE.");
    renderQueue(STAGE_STATUS.fluting, elements.flutingQueue);
  } catch (error) {
    showToast(error.message);
  }
});

elements.frostingAccept?.addEventListener("click", async () => {
  const rollId = document.getElementById("frosting-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }

  try {
    await requireNextQueueRoll(rollId, ["GRINDING_DONE"], "GRINDING_DONE");
    const roll = await fetchRollById(rollId);
    if (!roll.frosting_required) {
      throw new Error("This roll does not require frosting.");
    }
    await updateRoll(rollId, { status: "FROSTING" });
    showToast("Frosting specs accepted. Roll moved to FROSTING.");
    renderQueue(STAGE_STATUS.frosting, elements.frostingQueue);
  } catch (error) {
    showToast(error.message);
  }
});

elements.frostingDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("frosting-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }

  try {
    const roll = await fetchRollById(rollId);
    if (roll.status !== "FROSTING") {
      throw new Error("Roll must be FROSTING before done.");
    }
    await updateRoll(rollId, { status: "FROSTING_DONE" });
    showToast("Roll moved to FROSTING_DONE.");
    renderQueue(STAGE_STATUS.frosting, elements.frostingQueue);
  } catch (error) {
    showToast(error.message);
  }
});

// Crating & delivery

elements.cratingReady?.addEventListener("click", async () => {
  const rollId = document.getElementById("crating-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }
  try {
    const roll = await fetchRollById(rollId);
    const allowed = ["GRINDING_DONE", "FLUTING_DONE", "FROSTING_DONE", "CRATING_CHECKING"];
    if (!allowed.includes(roll.status)) {
      throw new Error(`Roll status ${roll.status} cannot be moved to READY_FOR_DELIVERY.`);
    }
    await updateRoll(rollId, { status: "READY_FOR_DELIVERY" });
    showToast("Marked READY_FOR_DELIVERY. Trigger delivery-ready email in Edge Function.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.deliveryDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("delivery-scan")?.value.trim();
  if (!rollId) {
    showToast("Scan a barcode into Roll ID first.");
    return;
  }
  try {
    const roll = await fetchRollById(rollId);
    if (roll.status !== "READY_FOR_DELIVERY") {
      throw new Error("Roll must be READY_FOR_DELIVERY before DELIVERED.");
    }
    await updateRoll(rollId, { status: "DELIVERED", delivered_at: new Date().toISOString() });
    showToast("Roll marked DELIVERED.");
  } catch (error) {
    showToast(error.message);
  }
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

  if (page === "grinding") {
    await renderQueue(STAGE_STATUS.grinding, elements.grindingQueue);
  }

  if (page === "fluting") {
    await renderQueue(STAGE_STATUS.fluting, elements.flutingQueue);
  }

  if (page === "frosting") {
    await renderQueue(STAGE_STATUS.frosting, elements.frostingQueue);
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
