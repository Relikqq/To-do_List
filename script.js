document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('taskForm');
    const calendarGrid = document.getElementById('calendarGrid');
    const headerCells = document.querySelectorAll('.calendar-grid .header-cell[data-day-idx]');

    // Загрузка сохраненных задач
    let tasks = JSON.parse(localStorage.getItem('calendarTasks')) || [];

    // Получение списка дней текущей недели (YYYY-MM-DD)
    function getCurrentWeekDays() {
        const now = new Date();
        const currentDay = now.getDay(); 
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        
        const monday = new Date(now);
        monday.setDate(now.getDate() + distanceToMonday);

        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            const year = day.getFullYear();
            const month = String(day.getMonth() + 1).padStart(2, '0');
            const date = String(day.getDate()).padStart(2, '0');
            weekDays.push(`${year}-${month}-${date}`);
        }
        return weekDays;
    }

    const currentWeekDates = getCurrentWeekDays();

    // Заполнение дат в шапке
    headerCells.forEach(cell => {
        const idx = parseInt(cell.dataset.dayIdx);
        const dateStr = currentWeekDates[idx];
        const [year, month, day] = dateStr.split('-');
        cell.innerHTML = `${cell.textContent}<br><span style="font-size: 11px; font-weight: normal;">${day}.${month}</span>`;
    });

    // Определение состояний (Активная сейчас / Ближайшая из будущих)
    function getTaskStatuses() {
        const now = new Date();
        let closestTask = null;
        let minDiff = Infinity;
        let currentTaskId = null;

        tasks.forEach(task => {
            if (task.status && task.status !== 'none') return;

            // Парсим полные диапазоны дат со временем
            const startDateTime = new Date(`${task.startDate}T${task.startTime}`);
            const endDateTime = new Date(`${task.endDate}T${task.endTime}`);
            
            // Если текущее время попадает внутрь интервала
            if (now >= startDateTime && now <= endDateTime) {
                currentTaskId = task.id;
            }

            const diff = startDateTime - now;
            if (diff > 0 && diff < minDiff) {
                minDiff = diff;
                closestTask = task;
            }
        });

        return {
            currentId: currentTaskId,
            nextId: currentTaskId ? null : (closestTask ? closestTask.id : null)
        };
    }

    // Хелпер форматирования даты для отображения внутри карточки (из YYYY-MM-DD в DD.MM)
    function formatMinDate(dateStr) {
        const [year, month, day] = dateStr.split('-');
        return `${day}.${month}`;
    }

    // Отрисовка сетки
    function renderCalendar() {
        for (let i = 0; i < 7; i++) {
            document.getElementById(`col-${i}`).innerHTML = '';
        }

        const statuses = getTaskStatuses();

        currentWeekDates.forEach((dateOfColumn, colIdx) => {
            const columnElem = document.getElementById(`col-${colIdx}`);

            // 1. Фильтруем задачи: день колонки должен лежать в интервале [startDate, endDate]
            const dayTasks = tasks.filter(task => {
                return dateOfColumn >= task.startDate && dateOfColumn <= task.endDate;
            });

            // 2. Сортируем задачи: если задача началась в предыдущие дни, для этой колонки её старт равен "00:00"
            dayTasks.sort((a, b) => {
                const aTime = a.startDate === dateOfColumn ? a.startTime : '00:00';
                const bTime = b.startDate === dateOfColumn ? b.startTime : '00:00';
                return aTime.localeCompare(bTime);
            });

            dayTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = 'task-card';
                card.dataset.id = task.id;
                
                if (task.status === 'completed') {
                    card.classList.add('status-completed');
                } else if (task.status === 'partial') {
                    card.classList.add('status-partial');
                } else if (task.status === 'failed') {
                    card.classList.add('status-failed');
                } else {
                    if (task.id === statuses.currentId) {
                        card.classList.add('task-current');
                    } else if (task.id === statuses.nextId) {
                        card.classList.add('task-next');
                    }
                }

                // Корректируем вывод времени: если задача многодневная, пишем даты, чтобы было понятно
                let timeDisplay = `${task.startTime} - ${task.endTime}`;
                if (task.startDate !== task.endDate) {
                    timeDisplay = `${formatMinDate(task.startDate)} ${task.startTime} → ${formatMinDate(task.endDate)} ${task.endTime}`;
                }

                card.innerHTML = `
                    <div class="task-time">${timeDisplay}</div>
                    <div class="task-title">${task.name}</div>
                    <div class="task-controls">
                        <select class="status-select" data-id="${task.id}">
                            <option value="none" ${task.status === 'none' ? 'selected' : ''}>Ожидание</option>
                            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Выполнено</option>
                            <option value="partial" ${task.status === 'partial' ? 'selected' : ''}>Частично</option>
                            <option value="failed" ${task.status === 'failed' ? 'selected' : ''}>Не выполнено</option>
                        </select>
                        <button class="delete-btn" data-id="${task.id}">×</button>
                    </div>
                `;

                columnElem.appendChild(card);
            });
        });
    }

    // Создание новой задачи с валидацией сквозного времени
    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('taskName').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;

        // Создаем полноценные объекты дат для точной валидации
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);

        if (startDateTime >= endDateTime) {
            alert('Дата и время начала не могут быть позже или равны времени окончания!');
            return;
        }

        const newTask = {
            id: Date.now(),
            name: name,
            startDate: startDate,
            endDate: endDate,
            startTime: startTime,
            endTime: endTime,
            status: 'none'
        };

        tasks.push(newTask);
        localStorage.setItem('calendarTasks', JSON.stringify(tasks));
        
        renderCalendar();
        taskForm.reset();
    });

    // Обработчик удаления
    calendarGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const taskId = parseInt(e.target.dataset.id);
            tasks = tasks.filter(task => task.id !== taskId);
            localStorage.setItem('calendarTasks', JSON.stringify(tasks));
            renderCalendar();
        }
    });

    // Обработчик смены статусов
    calendarGrid.addEventListener('change', (e) => {
        if (e.target.classList.contains('status-select')) {
            const taskId = parseInt(e.target.dataset.id);
            const newStatus = e.target.value;

            const task = tasks.find(t => t.id === taskId);
            if (task) {
                task.status = newStatus;
                localStorage.setItem('calendarTasks', JSON.stringify(tasks));
                renderCalendar();
            }
        }
    });

    renderCalendar();
    setInterval(renderCalendar, 60000);
});