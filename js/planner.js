
"use strict";

const StudyPlanner = (() => {
  function getPriority(task) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(`${task.deadline}T00:00:00`);
    const daysLeft = Math.ceil(
      (deadline.getTime() - today.getTime()) / 86400000
    );

    let score = 0;

    // Tasks due soon receive a higher priority.
    if (daysLeft < 0) score += 100;
    else if (daysLeft === 0) score += 80;
    else if (daysLeft === 1) score += 65;
    else if (daysLeft <= 3) score += 45;
    else if (daysLeft <= 7) score += 25;
    else score += 10;

    // Harder tasks need more attention.
    const difficultyScores = {
      Easy: 5,
      Medium: 15,
      Hard: 25
    };

    score += difficultyScores[task.difficulty] || 15;

    return {
      score,
      label:
        score >= 90 ? "Urgent" :
        score >= 65 ? "High" :
        score >= 40 ? "Medium" : "Low"
    };
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }

      const priorityDifference =
        getPriority(b).score - getPriority(a).score;

      if (priorityDifference !== 0) return priorityDifference;

      return a.deadline.localeCompare(b.deadline);
    });
  }

  function generateSchedule(tasks) {
    const pendingTasks = sortTasks(
      tasks.filter(task => !task.completed)
    );

    let currentTime = 9 * 60;
    const endTime = 21 * 60;
    const schedule = [];

    for (const task of pendingTasks) {
      const duration = Number(task.duration) || 60;

      // Leave room for breaks and avoid scheduling past 9 PM.
      if (currentTime + duration > endTime) {
        currentTime = 9 * 60;
        currentTime += 30;
      }

      if (currentTime + duration > endTime) {
        break;
      }

      const start = formatTime(currentTime);
      const finish = formatTime(currentTime + duration);

      schedule.push({
        id: task.id,
        title: task.title,
        subject: task.subject,
        start,
        finish,
        duration,
        priority: getPriority(task).label
      });

      currentTime += duration + 10;
    }

    return schedule;
  }

  function formatTime(minutes) {
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12;

    return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
  }

  return {
    getPriority,
    sortTasks,
    generateSchedule
  };
})();
