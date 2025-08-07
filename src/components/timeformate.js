  export const formatDateTime = (date) => {
    const pad = (num) => String(num).padStart(2, "0");
    return (
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds()
      )} ` +
      `${pad(date.getDate())}:${pad(date.getMonth() + 1)}:${date.getFullYear()}`
    );
  };