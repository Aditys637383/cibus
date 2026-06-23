// App Constants & Defaults
const DEFAULT_DISHES = [
  "Creamy Garlic Salmon",
  "Spaghetti Bolognese",
  "Beef & Cheese Tacos",
  "Chicken Tikka Masala",
  "Grilled Cheese & Tomato Soup",
  "Vegetable Stir Fry with Tofu",
  "Classic Margherita Pizza",
  "Lemon Herb Roast Chicken",
  "Hearty Beef Stew"
];

const DAYS_OF_WEEK = [
  { id: 'mon', name: 'Monday' },
  { id: 'tue', name: 'Tuesday' },
  { id: 'wed', name: 'Wednesday' },
  { id: 'thu', name: 'Thursday' },
  { id: 'fri', name: 'Friday' },
  { id: 'sat', name: 'Saturday' },
  { id: 'sun', name: 'Sunday' }
];

// App State
let state = {
  savedDishes: [],
  schedule: {}, // { mon: "Tacos", tue: "", ... }
  settings: {
    notificationsEnabled: false,
    reminderTime: "08:00"
  }
};

// Toast Notifications Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '🔔'}</span> ${message}`;
  
  toast.addEventListener('click', () => toast.remove());
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Load Initial Data
function initStorage() {
  // Load saved dishes
  const savedDishesStr = localStorage.getItem('savedDishes');
  if (savedDishesStr) {
    state.savedDishes = JSON.parse(savedDishesStr);
  } else {
    state.savedDishes = [...DEFAULT_DISHES];
    localStorage.setItem('savedDishes', JSON.stringify(state.savedDishes));
  }

  // Load schedule
  const scheduleStr = localStorage.getItem('schedule');
  if (scheduleStr) {
    state.schedule = JSON.parse(scheduleStr);
  } else {
    DAYS_OF_WEEK.forEach(day => {
      state.schedule[day.id] = "";
    });
    localStorage.setItem('schedule', JSON.stringify(state.schedule));
  }

  // Load settings
  const settingsStr = localStorage.getItem('settings');
  if (settingsStr) {
    state.settings = JSON.parse(settingsStr);
  }
}

function saveSchedule() {
  localStorage.setItem('schedule', JSON.stringify(state.schedule));
  checkDuplicates();
  updateServiceWorkerSchedule();
}

function saveDishes() {
  localStorage.setItem('savedDishes', JSON.stringify(state.savedDishes));
  renderIdeaBank();
}

function saveSettings() {
  localStorage.setItem('settings', JSON.stringify(state.settings));
  updateServiceWorkerSchedule();
}

// Render Date Badge
function renderHeaderDate() {
  const badge = document.getElementById('current-date-badge');
  const today = new Date();
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  badge.textContent = today.toLocaleDateString('en-US', options);
}

// Tab Switching Logic
function switchTab(tabId) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update sections
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(`view-${tabId}`).classList.add('active');
}

// Dynamic 7-Day Grid Generation
function renderPlanner() {
  const grid = document.getElementById('meal-grid');
  grid.innerHTML = '';

  const todayIndex = (new Date().getDay() + 6) % 7; // Monday is 0, Sunday is 6

  DAYS_OF_WEEK.forEach((day, index) => {
    const isToday = index === todayIndex;
    const dish = state.schedule[day.id] || "";

    const card = document.createElement('div');
    card.className = `day-card ${isToday ? 'today' : ''}`;
    card.id = `card-${day.id}`;

    card.innerHTML = `
      <div class="day-header">
        <div class="day-title-wrapper">
          <span class="day-name">${day.name}</span>
          ${isToday ? '<span class="badge-today">Today</span>' : ''}
        </div>
        ${dish ? `<button class="day-control-btn" onclick="clearDay('${day.id}')" aria-label="Clear ${day.name}">✕</button>` : ''}
      </div>
      
      <div class="meal-input-wrapper">
        <input type="text" 
               id="input-${day.id}" 
               class="meal-input-main" 
               placeholder="What's for dinner?" 
               value="${dish}"
               oninput="updateMeal('${day.id}', this.value)"
               onfocus="showDropdown('${day.id}')"
               onblur="hideDropdown('${day.id}')"
               autocomplete="off"
               aria-label="Meal for ${day.name}">
        <button class="suggestion-trigger-btn" onmousedown="toggleDropdownDirect('${day.id}', event)">💡</button>
        <div class="suggestion-dropdown" id="dropdown-${day.id}"></div>
      </div>
      
      <div class="warning-container" id="warning-${day.id}"></div>
    `;

    grid.appendChild(card);
    populateDropdown(day.id);
  });

  checkDuplicates();
}

// Handle Inputs & Dropdowns
function updateMeal(dayId, val) {
  state.schedule[dayId] = val;
  saveSchedule();
  
  // Show / Hide action button dynamically
  const card = document.getElementById(`card-${dayId}`);
  const header = card.querySelector('.day-header');
  
  // Update header x icon if value changes
  let clearBtn = header.querySelector('.day-control-btn');
  if (val && !clearBtn) {
    const btn = document.createElement('button');
    btn.className = 'day-control-btn';
    btn.innerHTML = '✕';
    btn.onclick = () => clearDay(dayId);
    btn.setAttribute('aria-label', `Clear ${DAYS_OF_WEEK.find(d => d.id === dayId).name}`);
    header.appendChild(btn);
  } else if (!val && clearBtn) {
    clearBtn.remove();
  }
}

function clearDay(dayId) {
  const input = document.getElementById(`input-${dayId}`);
  if (input) input.value = '';
  updateMeal(dayId, '');
}

function selectMealFromDropdown(dayId, val) {
  const input = document.getElementById(`input-${dayId}`);
  if (input) input.value = val;
  updateMeal(dayId, val);
  hideDropdown(dayId);
}

function populateDropdown(dayId) {
  const dropdown = document.getElementById(`dropdown-${dayId}`);
  if (!dropdown) return;

  dropdown.innerHTML = '';
  
  if (state.savedDishes.length === 0) {
    dropdown.innerHTML = `<div class="dropdown-item" style="color: var(--text-muted);">No saved ideas. Add some in Idea Bank!</div>`;
    return;
  }

  // Filter out dishes that are already scheduled to promote variety
  const scheduledDishes = Object.values(state.schedule).map(d => d.toLowerCase().trim()).filter(Boolean);
  const suggestedDishes = state.savedDishes.filter(dish => !scheduledDishes.includes(dish.toLowerCase().trim()));

  // If all favorite dishes are used, fallback to all saved dishes
  const listToRender = suggestedDishes.length > 0 ? suggestedDishes : state.savedDishes;

  listToRender.slice(0, 5).forEach(dish => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    item.textContent = dish;
    item.onmousedown = () => selectMealFromDropdown(dayId, dish);
    dropdown.appendChild(item);
  });
}

function showDropdown(dayId) {
  // Re-populate list to make sure we show dynamic recommendations
  populateDropdown(dayId);
  const dropdown = document.getElementById(`dropdown-${dayId}`);
  if (dropdown) dropdown.classList.add('active');
}

function hideDropdown(dayId) {
  // timeout allows mouse down event on items to fire first
  setTimeout(() => {
    const dropdown = document.getElementById(`dropdown-${dayId}`);
    if (dropdown) dropdown.classList.remove('active');
  }, 200);
}

function toggleDropdownDirect(dayId, event) {
  event.preventDefault();
  const dropdown = document.getElementById(`dropdown-${dayId}`);
  if (dropdown.classList.contains('active')) {
    hideDropdown(dayId);
  } else {
    document.getElementById(`input-${dayId}`).focus();
  }
}

// Variety Logic (Duplicate Detection)
function checkDuplicates() {
  const scheduleValues = {};
  
  // Group days by lowercased dish name
  DAYS_OF_WEEK.forEach(day => {
    const val = (state.schedule[day.id] || "").trim().toLowerCase();
    
    // Clear previous warning styling
    const card = document.getElementById(`card-${day.id}`);
    const warningContainer = document.getElementById(`warning-${day.id}`);
    if (card) card.classList.remove('duplicate-warning');
    if (warningContainer) warningContainer.innerHTML = '';

    if (val) {
      if (!scheduleValues[val]) {
        scheduleValues[val] = [];
      }
      scheduleValues[val].push(day);
    }
  });

  // Flag duplicates
  Object.keys(scheduleValues).forEach(dish => {
    const daysWithDish = scheduleValues[dish];
    if (daysWithDish.length > 1) {
      daysWithDish.forEach(day => {
        const card = document.getElementById(`card-${day.id}`);
        const warningContainer = document.getElementById(`warning-${day.id}`);
        
        if (card) card.classList.add('duplicate-warning');
        
        if (warningContainer) {
          // Find other days scheduling this dish
          const otherDays = daysWithDish
            .filter(d => d.id !== day.id)
            .map(d => d.name)
            .join(' and ');

          warningContainer.innerHTML = `
            <div class="warning-message">
              ⚠️ Repeated: Also scheduled for ${otherDays}!
            </div>
          `;
        }
      });
    }
  });
}

// Clear Entire Week
function clearWeek() {
  if (confirm("Are you sure you want to clear the entire weekly schedule?")) {
    DAYS_OF_WEEK.forEach(day => {
      state.schedule[day.id] = "";
      const input = document.getElementById(`input-${day.id}`);
      if (input) input.value = '';
    });
    saveSchedule();
    renderPlanner();
    showToast("Weekly schedule cleared!");
  }
}

// Idea Bank View Logic
function renderIdeaBank() {
  const list = document.getElementById('dish-list');
  const countBadge = document.getElementById('dish-count');
  const emptyState = document.getElementById('bank-empty');
  
  list.innerHTML = '';
  countBadge.textContent = `${state.savedDishes.length} dishes`;

  if (state.savedDishes.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  state.savedDishes.forEach((dish, index) => {
    const li = document.createElement('li');
    li.className = 'dish-item';
    li.innerHTML = `
      <span>${dish}</span>
      <button class="dish-delete-btn" onclick="deleteDish(${index})" aria-label="Delete ${dish}">✕</button>
    `;
    list.appendChild(li);
  });
}

function addDish(e) {
  e.preventDefault();
  const input = document.getElementById('new-dish-input');
  const value = input.value.trim();
  
  if (!value) return;

  if (state.savedDishes.some(d => d.toLowerCase() === value.toLowerCase())) {
    showToast("This dish is already in your Idea Bank!", "warning");
    return;
  }

  state.savedDishes.push(value);
  saveDishes();
  input.value = '';
  showToast(`Added "${value}" to Idea Bank!`);
}

function deleteDish(index) {
  const dish = state.savedDishes[index];
  state.savedDishes.splice(index, 1);
  saveDishes();
  showToast(`Removed "${dish}"`);
}

// Randomizer Modal Suggestion Logic
let suggestedMealTemp = "";

function handleRandomizer() {
  const scheduledDishes = Object.values(state.schedule).map(d => d.toLowerCase().trim()).filter(Boolean);
  
  // Find unscheduled favorite ideas
  const unscheduledSaved = state.savedDishes.filter(
    dish => !scheduledDishes.includes(dish.toLowerCase().trim())
  );

  let recommendation = "";
  if (unscheduledSaved.length > 0) {
    recommendation = unscheduledSaved[Math.floor(Math.random() * unscheduledSaved.length)];
  } else if (state.savedDishes.length > 0) {
    // If all saved dishes have been scheduled at least once, fallback to any random choice
    recommendation = state.savedDishes[Math.floor(Math.random() * state.savedDishes.length)];
  } else {
    showToast("Add some favorite dishes in the Idea Bank first!", "warning");
    switchTab('bank');
    return;
  }

  suggestedMealTemp = recommendation;
  
  // Setup Assign Day Options (only empty days or all days)
  const assignSelect = document.getElementById('assign-day-select');
  assignSelect.innerHTML = '';

  DAYS_OF_WEEK.forEach(day => {
    const isToday = day.id === DAYS_OF_WEEK[(new Date().getDay() + 6) % 7].id;
    const label = `${day.name}${state.schedule[day.id] ? ` (Currently: ${state.schedule[day.id]})` : ' (Empty)'}${isToday ? ' - Today' : ''}`;
    
    const option = document.createElement('option');
    option.value = day.id;
    option.textContent = label;
    // Prefer selecting the first empty day, or today
    if (!state.schedule[day.id]) {
      option.selected = true;
    }
    assignSelect.appendChild(option);
  });

  // Open Modal
  document.getElementById('suggested-dish-name').textContent = recommendation;
  document.getElementById('randomizer-modal').classList.add('active');
}

function closeModal() {
  document.getElementById('randomizer-modal').classList.remove('active');
}

function confirmSuggestion() {
  const dayId = document.getElementById('assign-day-select').value;
  if (!dayId) return;

  const dayName = DAYS_OF_WEEK.find(d => d.id === dayId).name;
  updateMeal(dayId, suggestedMealTemp);
  renderPlanner();
  closeModal();
  showToast(`Assigned "${suggestedMealTemp}" to ${dayName}!`);
}

// Notification & SW Setup
function initNotifications() {
  const toggle = document.getElementById('toggle-notifications');
  const timeRow = document.getElementById('time-setting-row');
  const timeInput = document.getElementById('reminder-time');

  toggle.checked = state.settings.notificationsEnabled;
  if (state.settings.notificationsEnabled) {
    timeRow.classList.remove('disabled-row');
  }

  timeInput.value = state.settings.reminderTime;

  toggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    if (enabled) {
      // Request system notification permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        state.settings.notificationsEnabled = true;
        timeRow.classList.remove('disabled-row');
        showToast("Cooking reminders enabled!");
      } else {
        toggle.checked = false;
        showToast("Notification permission was denied.", "warning");
      }
    } else {
      state.settings.notificationsEnabled = false;
      timeRow.classList.add('disabled-row');
      showToast("Reminders disabled.");
    }
    saveSettings();
  });

  timeInput.addEventListener('change', (e) => {
    state.settings.reminderTime = e.target.value;
    saveSettings();
    showToast(`Reminders scheduled for ${e.target.value}`);
  });

  // Simulator
  document.getElementById('btn-simulate-notification').addEventListener('click', triggerSimulatedNotification);
}

// Trigger browser native notification instantly for testing
function triggerSimulatedNotification() {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        fireTodayMealNotification();
      } else {
        showToast("Please allow notification permission to test.", "warning");
      }
    });
  } else {
    fireTodayMealNotification();
  }
}

function fireTodayMealNotification() {
  const todayDay = DAYS_OF_WEEK[(new Date().getDay() + 6) % 7];
  const meal = state.schedule[todayDay.id];
  
  let title = "Meally Recipe Alert 🍳";
  let options = {};
  
  if (meal) {
    options = {
      body: `Today is ${todayDay.name}. You scheduled: "${meal}"! Get cooking!`,
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png'
    };
  } else {
    options = {
      body: "No meal planned for today! Tap here to pick a quick idea from Meally.",
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png'
    };
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, options);
    });
  } else {
    new Notification(title, options);
  }
  showToast("Alert simulation sent!");
}

// Service Worker Registration
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => {
        console.log('Service Worker Registered Successfully', reg);
        updateServiceWorkerSchedule();
      })
      .catch(err => console.error('Service Worker registration failed', err));
  }
}

function updateServiceWorkerSchedule() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SYNC_DATA',
      schedule: state.schedule,
      settings: state.settings,
      days: DAYS_OF_WEEK
    });
  }
}

// Factory Reset
function handleFactoryReset() {
  if (confirm("This will clear all your go-to dishes and calendar settings permanently. Continue?")) {
    localStorage.clear();
    location.reload();
  }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  renderHeaderDate();
  renderPlanner();
  renderIdeaBank();
  initNotifications();
  registerSW();

  // Button triggers
  document.getElementById('btn-randomizer').addEventListener('click', handleRandomizer);
  document.getElementById('btn-clear-week').addEventListener('click', clearWeek);
  document.getElementById('add-dish-form').addEventListener('submit', addDish);
  document.getElementById('btn-confirm-suggestion').addEventListener('click', confirmSuggestion);
  document.getElementById('btn-factory-reset').addEventListener('click', handleFactoryReset);
});
