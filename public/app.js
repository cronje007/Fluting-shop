import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://mancjsrbmzgrvytenxvn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DRmpAmFFMNmAOPM0ZglN7g_-EHX5jNd";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const page = document.body?.dataset.page;
let selectedCustomerRollId = null;

const elements = {
  customerLogin: document.getElementById("customer-login"),
  employeeLogin: document.getElementById("employee-login"),
  employeeRole: document.getElementById("employee-role"),
  printBarcode: document.getElementById("print-barcode"),
  barcodeSvg: document.getElementById("barcode"),
  checkinRollId: document.getElementById("checkin-roll-id"),
  checkinRollName: document.getElementById("checkin-roll-name"),
  checkinGenerateId: document.getElementById("checkin-generate-id"),
  createRoll: document.getElementById("create-roll"),
  sendApproval: document.getElementById("send-approval"),
  customerQueue: document.getElementById("customer-queue"),
  customerStageQueues: document.getElementById("customer-stage-queues"),
  customerAwaitingList: document.getElementById("customer-awaiting-list"),
  customerRollDetails: document.getElementById("customer-roll-details"),
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
  adminSaveCounter: document.getElementById("admin-save-counter"),
  adminLoadCounter: document.getElementById("admin-load-counter"),
  adminRollCounter: document.getElementById("admin-roll-counter"),
  grindingQueue: document.getElementById("grinding-queue"),
  flutingQueue: document.getElementById("fluting-queue"),
  frostingQueue: document.getElementById("frosting-queue"),
  controllerQueue: document.getElementById("controller-queue"),
  cratingQueue: document.getElementById("crating-queue"),
  deliveryQueue: document.getElementById("delivery-queue"),
};

const STAGE_STATUS = {
  controller: ["CHECKED_IN", "AWAITING_CUSTOMER_APPROVAL", "REJECTED", "SCRAPPED"],
  grinding: ["APPROVED", "GRINDING"],
  fluting: ["GRINDING_DONE", "FLUTING"],
  frosting: ["GRINDING_DONE", "FROSTING"],
  crating: ["GRINDING_DONE", "FLUTING_DONE", "FROSTING_DONE", "CRATING_CHECKING"],
  delivery: ["READY_FOR_DELIVERY"],
};

const showToast = (message) => window.alert(message);

const sortQueue = (rows) =>
  [...rows].sort((a, b) => {
    const pa = a.priority === "A" ? 0 : 1;
    const pb = b.priority === "A" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(a.checked_in_at).getTime() - new Date(b.checked_in_at).getTime();
  });

const rollLabel = (roll) => `${roll.roll_name ?? roll.roll_id} [${roll.roll_id}]`;

const fetchRollById = async (rollId) => {
  const { data, error } = await supabase
    .from("rolls")
    .select("id,roll_id,roll_name,status,mill_name,rejected_note,fluting_required,frosting_required,priority,checked_in_at,controller_notes,diameter,visible_cracks,cracks_notes,price_quote,fluting_specs,frosting_specs")
    .eq("roll_id", rollId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const updateRoll = async (rollId, patch) => {
  const { error } = await supabase.from("rolls").update(patch).eq("roll_id", rollId);
  if (error) throw error;
};

const fetchStageQueue = async (statuses) => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id,roll_name,mill_name,status,priority,checked_in_at,fluting_specs,frosting_specs")
    .in("status", statuses);
  if (error) throw error;
  return sortQueue(data ?? []);
};

const renderQueue = async (statuses, target, onSelect) => {
  if (!target) return;
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
    li.textContent = `${idx + 1}. ${rollLabel(roll)} — ${roll.mill_name} — Priority ${roll.priority ?? "B"} — ${roll.status}`;
    if (onSelect) {
      li.style.cursor = "pointer";
      li.addEventListener("click", () => onSelect(roll));
    }
    target.appendChild(li);
  });
};

const requireNextQueueRoll = async (rollId, statuses, expected) => {
  const queue = await fetchStageQueue(statuses);
  if (!queue.length) throw new Error("No rolls are currently eligible in this queue.");
  if (queue[0].roll_id !== rollId) throw new Error(`Roll ${rollId} is not next. Next is ${queue[0].roll_id}.`);
  const current = await fetchRollById(rollId);
  if (!current) throw new Error("Roll not found.");
  if (current.status !== expected) throw new Error(`Roll ${rollId} must be ${expected}.`);
  return current;
};

const fetchCustomerRolls = async () => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id,roll_name,mill_name,status,checked_in_at")
    .order("checked_in_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

const fetchAwaitingCustomerRolls = async () => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id,roll_name,mill_name,status,checked_in_at,controller_notes,diameter,visible_cracks,cracks_notes,price_quote,fluting_specs,frosting_specs")
    .eq("status", "AWAITING_CUSTOMER_APPROVAL")
    .order("checked_in_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

const fetchQueueCount = async () => {
  const statuses = ["APPROVED", "GRINDING", "GRINDING_DONE", "FLUTING", "FROSTING", "FLUTING_DONE", "FROSTING_DONE", "CRATING_CHECKING", "READY_FOR_DELIVERY"];
  const { data, error } = await supabase.from("rolls").select("id").in("status", statuses);
  if (error) return 0;
  return data?.length ?? 0;
};

const handleLogin = async (email, password) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message);
    return false;
  }
  return true;
};

const getNextRollId = async () => {
  const { data, error } = await supabase.rpc("next_roll_id");
  if (error) throw error;
  return data;
};

const getCurrentCounter = async () => {
  const { data, error } = await supabase.rpc("get_current_roll_id_counter");
  if (error) throw error;
  return data;
};

const setCounter = async (value) => {
  const { error } = await supabase.rpc("set_roll_id_counter", { p_value: Number(value) });
  if (error) throw error;
};

const getReworkRollId = async (baseRollId) => {
  const { data, error } = await supabase
    .from("rolls")
    .select("roll_id")
    .ilike("roll_id", `${baseRollId}-R%`);
  if (error) throw error;
  const nums = (data ?? [])
    .map((r) => Number((r.roll_id.match(/-R(\d+)$/) || [])[1]))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${baseRollId}-R${next}`;
};

const renderCustomerSelectedRollDetails = (roll) => {
  if (!elements.customerRollDetails) return;
  if (!roll) {
    elements.customerRollDetails.textContent = "Click a roll above, then review details and approve/reject.";
    return;
  }

  elements.customerRollDetails.innerHTML = `
    <strong>${rollLabel(roll)} — ${roll.mill_name}</strong><br/>
    Status: ${roll.status}<br/>
    Diameter: ${roll.diameter ?? "--"}<br/>
    Visible Cracks: ${roll.visible_cracks === null ? "--" : roll.visible_cracks ? "Yes" : "No"}<br/>
    Cracks Notes: ${roll.cracks_notes ?? "--"}<br/>
    Controller Notes: ${roll.controller_notes ?? "--"}<br/>
    Price Quote: ${roll.price_quote ?? "--"}<br/>
    Fluting Specs: ${roll.fluting_specs ?? "--"}<br/>
    Frosting Specs: ${roll.frosting_specs ?? "--"}
  `;
};

const refreshCustomerApprovalList = async () => {
  if (!elements.customerAwaitingList) return;
  const rolls = await fetchAwaitingCustomerRolls();
  elements.customerAwaitingList.innerHTML = "";

  if (!rolls.length) {
    const li = document.createElement("li");
    li.textContent = "No rolls waiting for approval.";
    elements.customerAwaitingList.appendChild(li);
    selectedCustomerRollId = null;
    renderCustomerSelectedRollDetails(null);
    return;
  }

  rolls.forEach((roll) => {
    const li = document.createElement("li");
    li.textContent = `${rollLabel(roll)} — ${roll.mill_name} `;

    const btn = document.createElement("button");
    btn.textContent = "Show Roll Details";
    btn.type = "button";
    btn.addEventListener("click", () => {
      selectedCustomerRollId = roll.roll_id;
      renderCustomerSelectedRollDetails(roll);
    });

    li.appendChild(document.createTextNode(" "));
    li.appendChild(btn);
    elements.customerAwaitingList.appendChild(li);
  });

  if (!selectedCustomerRollId && rolls[0]) {
    selectedCustomerRollId = rolls[0].roll_id;
    renderCustomerSelectedRollDetails(rolls[0]);
  }
};

const refreshCustomerQueues = async () => {
  if (!elements.customerStageQueues) return;
  const stages = [
    ["Controller", STAGE_STATUS.controller],
    ["Grinding", STAGE_STATUS.grinding],
    ["Fluting", STAGE_STATUS.fluting],
    ["Frosting", STAGE_STATUS.frosting],
    ["Crating", STAGE_STATUS.crating],
    ["Delivery", STAGE_STATUS.delivery],
  ];
  elements.customerStageQueues.innerHTML = "";
  for (const [name, statuses] of stages) {
    const queue = await fetchStageQueue(statuses);
    const li = document.createElement("li");
    const preview = queue.slice(0, 5).map((r) => `${rollLabel(r)} (${r.mill_name})`).join(", ") || "No rolls";
    li.textContent = `${name}: ${preview}`;
    elements.customerStageQueues.appendChild(li);
  }
};

const refreshStationQueues = async () => {
  await Promise.all([
    renderQueue(STAGE_STATUS.controller, elements.controllerQueue),
    renderQueue(STAGE_STATUS.grinding, elements.grindingQueue),
    renderQueue(STAGE_STATUS.fluting, elements.flutingQueue, (roll) => {
      const scan = document.getElementById("fluting-scan");
      const specs = document.getElementById("fluting-specs");
      if (scan) scan.value = roll.roll_id;
      if (specs) specs.textContent = roll.fluting_specs || "No fluting specs entered.";
    }),
    renderQueue(STAGE_STATUS.frosting, elements.frostingQueue, (roll) => {
      const scan = document.getElementById("frosting-scan");
      const specs = document.getElementById("frosting-specs");
      if (scan) scan.value = roll.roll_id;
      if (specs) specs.textContent = roll.frosting_specs || "No frosting specs entered.";
    }),
    renderQueue(STAGE_STATUS.crating, elements.cratingQueue),
    renderQueue(STAGE_STATUS.delivery, elements.deliveryQueue),
  ]);
};

const getSelectedCustomerRollId = () => {
  if (selectedCustomerRollId) return selectedCustomerRollId;
  throw new Error("Please click 'Show Roll Details' for a roll first.");
};

// Login
elements.customerLogin?.addEventListener("click", async () => {
  const ok = await handleLogin(document.getElementById("customer-email").value, document.getElementById("customer-password").value);
  if (ok) window.location.href = "customer.html";
});

elements.employeeLogin?.addEventListener("click", async () => {
  const ok = await handleLogin(document.getElementById("employee-email").value, document.getElementById("employee-password").value);
  if (ok) window.location.href = `${elements.employeeRole.value}.html`;
});

// Check-in
elements.checkinGenerateId?.addEventListener("click", async () => {
  try {
    const nextId = await getNextRollId();
    elements.checkinRollId.value = nextId;
    showToast(`Generated Roll ID: ${nextId}`);
  } catch (error) {
    showToast(error.message);
  }
});

elements.printBarcode?.addEventListener("click", () => {
  const rollId = elements.checkinRollId.value.trim();
  if (!rollId) return showToast("Enter a Roll ID first.");
  JsBarcode(elements.barcodeSvg, rollId, { format: "CODE128", displayValue: true });
});

elements.createRoll?.addEventListener("click", async () => {
  let rollId = elements.checkinRollId.value.trim();
  if (!rollId) return showToast("Roll ID is required.");

  try {
    const existing = await fetchRollById(rollId);
    if (existing) {
      const reuse = window.confirm(`Roll ID ${rollId} already exists. Reupload as rework version?`);
      if (!reuse) return;
      rollId = await getReworkRollId(rollId);
      elements.checkinRollId.value = rollId;
      showToast(`Using rework roll id ${rollId}`);
    }

    const payload = {
      roll_id: rollId,
      roll_name: elements.checkinRollName?.value.trim() || null,
      mill_name: document.getElementById("checkin-mill").value.trim(),
      date_received: document.getElementById("checkin-date").value,
      fluting_required: document.getElementById("checkin-fluting").checked,
      frosting_required: document.getElementById("checkin-frosting").checked,
      status: "CHECKED_IN",
    };

    const { error } = await supabase.from("rolls").insert(payload);
    if (error) throw error;
    showToast("Roll created in CHECKED_IN.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

// Controller
elements.sendApproval?.addEventListener("click", async () => {
  const rollId = document.getElementById("controller-scan")?.value.trim();
  if (!rollId) return showToast("Scan a roll barcode first.");
  try {
    await updateRoll(rollId, {
      controller_notes: document.getElementById("controller-notes").value.trim() || null,
      diameter: Number(document.getElementById("controller-diameter").value) || null,
      visible_cracks: document.getElementById("controller-cracks").checked,
      cracks_notes: document.getElementById("controller-crack-notes").value.trim() || null,
      price_quote: Number(document.getElementById("controller-quote").value) || null,
      fluting_specs: document.getElementById("controller-fluting").value.trim() || null,
      frosting_specs: document.getElementById("controller-frosting").value.trim() || null,
      status: "AWAITING_CUSTOMER_APPROVAL",
    });
    showToast("Moved to AWAITING_CUSTOMER_APPROVAL.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

// Customer
elements.approveRoll?.addEventListener("click", async () => {
  const priority = document.getElementById("customer-priority")?.value;
  try {
    const rollId = getSelectedCustomerRollId();
    await updateRoll(rollId, { priority, status: "APPROVED", rejected_note: null, approved_at: new Date().toISOString() });
    showToast("Roll approved.");
    await init();
  } catch (error) {
    showToast(error.message);
  }
});

elements.rejectIncorrect?.addEventListener("click", async () => {
  const note = document.getElementById("customer-reject-note")?.value.trim();
  if (!note) return showToast("Please enter incorrect info note.");
  try {
    const rollId = getSelectedCustomerRollId();
    await updateRoll(rollId, { status: "REJECTED", rejected_note: note });
    showToast("Roll rejected for incorrect info.");
    await init();
  } catch (error) {
    showToast(error.message);
  }
});

elements.rejectScrap?.addEventListener("click", async () => {
  if (!window.confirm("Confirm scrap roll?")) return;
  if (!window.confirm("Final confirm: scrap permanently?")) return;
  try {
    const rollId = getSelectedCustomerRollId();
    await updateRoll(rollId, { status: "SCRAPPED", scrapped_at: new Date().toISOString() });
    showToast("Roll set to SCRAPPED.");
    await init();
  } catch (error) {
    showToast(error.message);
  }
});

// Grinding
elements.grindingNew?.addEventListener("click", async () => {
  const rollId = document.getElementById("grinding-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    await requireNextQueueRoll(rollId, ["APPROVED"], "APPROVED");
    await updateRoll(rollId, { status: "GRINDING" });
    showToast("Roll checked in at GRINDING.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

elements.grindingDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("grinding-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await fetchRollById(rollId);
    if (!roll || roll.status !== "GRINDING") throw new Error("Roll must be in GRINDING.");
    await updateRoll(rollId, { status: "GRINDING_DONE" });
    showToast("Roll moved to GRINDING_DONE.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

// Fluting/Frosting preview on barcode scan
for (const [scanId, specsId, field] of [["fluting-scan", "fluting-specs", "fluting_specs"], ["frosting-scan", "frosting-specs", "frosting_specs"]]) {
  const scan = document.getElementById(scanId);
  const specs = document.getElementById(specsId);
  scan?.addEventListener("change", async () => {
    const rollId = scan.value.trim();
    if (!rollId || !specs) return;
    try {
      const roll = await fetchRollById(rollId);
      specs.textContent = roll?.[field] || "No specs entered.";
    } catch {
      specs.textContent = "Unable to load specs.";
    }
  });
}

elements.flutingAccept?.addEventListener("click", async () => {
  const rollId = document.getElementById("fluting-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await requireNextQueueRoll(rollId, ["GRINDING_DONE"], "GRINDING_DONE");
    if (!roll.fluting_required) throw new Error("This roll does not require fluting.");
    if (!window.confirm(`Fluting Specs:\n\n${roll.fluting_specs || "No fluting specs entered."}\n\nAccept and move roll to FLUTING?`)) return;
    await updateRoll(rollId, { status: "FLUTING" });
    showToast("Roll moved to FLUTING.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

elements.flutingDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("fluting-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await fetchRollById(rollId);
    if (!roll || roll.status !== "FLUTING") throw new Error("Roll must be FLUTING.");
    await updateRoll(rollId, { status: "FLUTING_DONE" });
    showToast("Roll moved to FLUTING_DONE.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

elements.frostingAccept?.addEventListener("click", async () => {
  const rollId = document.getElementById("frosting-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await requireNextQueueRoll(rollId, ["GRINDING_DONE"], "GRINDING_DONE");
    if (!roll.frosting_required) throw new Error("This roll does not require frosting.");
    if (!window.confirm(`Frosting Specs:\n\n${roll.frosting_specs || "No frosting specs entered."}\n\nAccept and move roll to FROSTING?`)) return;
    await updateRoll(rollId, { status: "FROSTING" });
    showToast("Roll moved to FROSTING.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

elements.frostingDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("frosting-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await fetchRollById(rollId);
    if (!roll || roll.status !== "FROSTING") throw new Error("Roll must be FROSTING.");
    await updateRoll(rollId, { status: "FROSTING_DONE" });
    showToast("Roll moved to FROSTING_DONE.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

// Crating & Delivery
elements.cratingReady?.addEventListener("click", async () => {
  const rollId = document.getElementById("crating-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await fetchRollById(rollId);
    if (!roll || !["GRINDING_DONE", "FLUTING_DONE", "FROSTING_DONE", "CRATING_CHECKING"].includes(roll.status)) {
      throw new Error("Roll cannot move to READY_FOR_DELIVERY from current status.");
    }
    await updateRoll(rollId, { status: "READY_FOR_DELIVERY" });
    showToast("Marked READY_FOR_DELIVERY.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

elements.deliveryDone?.addEventListener("click", async () => {
  const rollId = document.getElementById("delivery-scan")?.value.trim();
  if (!rollId) return showToast("Scan barcode first.");
  try {
    const roll = await fetchRollById(rollId);
    if (!roll || roll.status !== "READY_FOR_DELIVERY") throw new Error("Roll must be READY_FOR_DELIVERY.");
    await updateRoll(rollId, { status: "DELIVERED", delivered_at: new Date().toISOString() });
    showToast("Marked DELIVERED.");
    await refreshStationQueues();
  } catch (error) {
    showToast(error.message);
  }
});

// Admin
elements.adminTrack?.addEventListener("click", async () => {
  const rollId = document.getElementById("admin-roll-id")?.value.trim();
  if (!rollId) return showToast("Enter a Roll ID.");
  try {
    const data = await fetchRollById(rollId);
    if (!data) throw new Error("Roll not found.");
    elements.adminRollDetails.textContent = `${rollLabel(data)} (${data.mill_name}) is ${data.status}.`;
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminSaveCounter?.addEventListener("click", async () => {
  try {
    const value = elements.adminRollCounter?.value;
    if (!value) throw new Error("Enter counter value.");
    await setCounter(value);
    showToast("Roll ID counter updated.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminLoadCounter?.addEventListener("click", async () => {
  try {
    const value = await getCurrentCounter();
    if (elements.adminRollCounter) elements.adminRollCounter.value = value;
  } catch (error) {
    showToast(error.message);
  }
});

elements.controllerLookupBtn?.addEventListener("click", async () => {
  const rollId = document.getElementById("controller-lookup")?.value.trim();
  if (!rollId) return showToast("Enter a Roll ID.");
  try {
    const data = await fetchRollById(rollId);
    if (!data) throw new Error("Roll not found.");
    elements.controllerStatus.textContent = `${data.status}: ${rollLabel(data)} (${data.mill_name}) ${data.rejected_note ?? ""}`;
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminCreateCustomer?.addEventListener("click", async () => {
  try {
    const payload = {
      mill_name: document.getElementById("admin-customer-mill").value.trim(),
      email: document.getElementById("admin-customer-email").value.trim(),
      auth_user_id: document.getElementById("admin-customer-auth").value.trim() || null,
    };
    const { error } = await supabase.from("customers").insert(payload);
    if (error) throw error;
    showToast("Customer created.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminCreateEmployee?.addEventListener("click", async () => {
  try {
    const payload = {
      role: document.getElementById("admin-employee-role").value,
      display_name: document.getElementById("admin-employee-name").value.trim(),
      auth_user_id: document.getElementById("admin-employee-auth").value.trim() || null,
    };
    const { error } = await supabase.from("employees").insert(payload);
    if (error) throw error;
    showToast("Employee created.");
  } catch (error) {
    showToast(error.message);
  }
});

const init = async () => {
  if (page === "customer") {
    if (elements.customerQueue) elements.customerQueue.textContent = await fetchQueueCount();
    if (elements.customerRollList) {
      const rolls = await fetchCustomerRolls();
      elements.customerRollList.innerHTML = "";
      rolls.forEach((roll) => {
        const li = document.createElement("li");
        li.textContent = `${rollLabel(roll)} — ${roll.mill_name} — ${roll.status}`;
        elements.customerRollList.appendChild(li);
      });
    }
    await refreshCustomerApprovalList();
    await refreshCustomerQueues();
  }

  if (["controller", "grinding", "fluting", "frosting", "crating", "delivery"].includes(page)) {
    await refreshStationQueues();
  }

  if (page === "admin") {
    const { data: metrics } = await supabase.from("roll_turnaround_metrics").select("avg_turnaround_hours,max_turnaround_hours").single();
    const { data: longest } = await supabase.from("longest_turnaround_roll").select("roll_id,mill_name,turnaround_hours").single();
    if (metrics && elements.metricAverage) elements.metricAverage.textContent = `${metrics.avg_turnaround_hours?.toFixed(1) ?? "--"} hrs`;
    if (elements.metricLongest) {
      elements.metricLongest.textContent = longest?.roll_id
        ? `${longest.roll_id} (${longest.mill_name}) - ${longest.turnaround_hours?.toFixed(1)} hrs`
        : `${metrics?.max_turnaround_hours?.toFixed(1) ?? "--"} hrs`;
    }
    try {
      const v = await getCurrentCounter();
      if (elements.adminRollCounter) elements.adminRollCounter.value = v;
    } catch {
      // optional if SQL not applied yet
    }
  }
};

init().catch((error) => showToast(error.message));
