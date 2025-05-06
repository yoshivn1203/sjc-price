document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('price-body');
  const errorDiv = document.getElementById('error');
  const lastUpdated = document.getElementById('last-updated');
  const spinner = document.getElementById('spinner');
  const showChartLink = document.getElementById('show-chart-link');
  const chartSection = document.getElementById('chart-section');
  const backToTableBtn = document.getElementById('back-to-table');
  const priceTable = document.getElementById('price-table');
  const dateRangeSelect = document.getElementById('date-range-select');
  const goldTypeSelect = document.getElementById('gold-type-select');
  const worldGoldPriceDiv = document.getElementById('world-gold-price');
  let sjcSellPrice = null; // To store the SJC sell price for comparison

  spinner.style.display = 'block';

  // await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const response = await fetch(
      'https://sjc.com.vn/GoldPrice/Services/PriceService.ashx'
    );
    const data = await response.json();

    if (data.success) {
      // Manually format: dd/MM/yyyy, HH:mm
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      lastUpdated.textContent = `Bảng giá được cập nhật lúc: ${day}/${month}/${year} ${hour}:${minute}, và chỉ mang tính chất tham khảo`;

      tableBody.innerHTML = '';

      // Group data by BranchName
      const grouped = {};
      data.data.forEach((item) => {
        if (!grouped[item.BranchName]) {
          grouped[item.BranchName] = [];
        }
        grouped[item.BranchName].push(item);
      });

      // Render grouped rows
      Object.keys(grouped).forEach((branch) => {
        // Branch header row
        const branchRow = document.createElement('tr');
        branchRow.innerHTML = `
          <td colspan="4" style="background:#d0a448; color:white; font-weight:bold; text-align:left;">${branch}</td>
        `;
        tableBody.appendChild(branchRow);

        // Gold type rows for this branch
        grouped[branch].forEach((item) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${item.TypeName}</td>
            <td>${item.Buy}</td>
            <td>${item.Sell}</td>
          `;
          tableBody.appendChild(row);
        });
      });

      // Find Hồ Chí Minh, Vàng SJC 1L, 10L, 1KG, Sell price
      const hcmBranch = data.data.find(
        (item) =>
          item.BranchName === 'Hồ Chí Minh' &&
          item.TypeName.includes('Vàng SJC 1L, 10L, 1KG')
      );
      if (hcmBranch) {
        // Remove commas and parse as number
        sjcSellPrice = parseFloat(String(hcmBranch.Sell).replace(/,/g, ''));
      }
    } else {
      throw new Error('API request failed');
    }
  } catch (error) {
    errorDiv.textContent = 'Error fetching data: ' + error.message;
    errorDiv.style.display = 'block';
  } finally {
    spinner.style.display = 'none';
  }

  let goldHistoryData = null; // cache for chart data

  // Helper to format date as dd/MM/yyyy
  function formatDate(date) {
    const d = date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Fetch and draw chart for selected range and goldPriceId
  async function updateChartForRangeAndType() {
    const days = parseInt(dateRangeSelect.value, 10);
    const goldPriceId = parseInt(goldTypeSelect.value, 10);
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - (days - 1));
    const fromDateStr = formatDate(fromDate);
    const toDateStr = formatDate(toDate);

    const historyData = await fetchGoldPriceHistory(
      goldPriceId,
      fromDateStr,
      toDateStr
    );
    goldHistoryData = historyData.data;
    drawGoldChart(goldHistoryData);
  }

  // Show chart when link is clicked
  showChartLink.addEventListener('click', (e) => {
    e.preventDefault();
    priceTable.style.display = 'none';
    showChartLink.style.display = 'none';
    worldGoldPriceDiv.style.display = 'none';
    chartSection.style.display = 'block';
    // Default to 1 day and HCM
    dateRangeSelect.value = '1';
    goldTypeSelect.value = '1';
    updateChartForRangeAndType();
  });

  // Back to table when back button is clicked
  backToTableBtn.addEventListener('click', () => {
    chartSection.style.display = 'none';
    priceTable.style.display = '';
    showChartLink.style.display = '';
    worldGoldPriceDiv.style.display = '';
  });

  // Change chart when date range or gold type changes
  dateRangeSelect.addEventListener('change', updateChartForRangeAndType);
  goldTypeSelect.addEventListener('change', updateChartForRangeAndType);

  // Fetch the current USD/VND exchange rate from SJC API
  async function fetchUsdVndRate() {
    try {
      const response = await fetch(
        'https://sjc.com.vn/GoldPrice/Services/PriceService.ashx',
        {
          method: 'POST',
          headers: {
            accept: '*/*',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          body: 'method=GetExchangeRate'
        }
      );
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        const usd = data.data.find((item) => item.CurrencyCode === 'USD');
        if (usd && usd.Sell) {
          // Remove commas and parse as number
          return parseFloat(usd.Sell.replace(/,/g, ''));
        }
      }
    } catch (e) {
      // ignore, will handle error in main function
    }
    return null;
  }

  // Fetch and display world gold price and comparison
  async function fetchWorldGoldPriceAndCompare() {
    try {
      // Fetch exchange rate first
      const usdToVnd = await fetchUsdVndRate();

      const response = await fetch('https://api.gold-api.com/price/XAU');
      const data = await response.json();
      if (data && data.price && usdToVnd) {
        // Convert world price (USD/oz) to VND/lượng
        const ozToLuong = 0.829429; // 1 oz = 0.829429 lượng

        const worldPriceVNDPerLuong = (data.price * usdToVnd) / ozToLuong;

        let compareText = '';
        if (sjcSellPrice) {
          const percent =
            ((sjcSellPrice * 1000 - worldPriceVNDPerLuong) /
              worldPriceVNDPerLuong) *
            100;
          compareText = `<br/><b>Chênh lệch so với SJC (HCM, 1L, 10L, 1KG): ${percent.toFixed(
            2
          )}%</b>`;
        }

        worldGoldPriceDiv.innerHTML =
          `<b>Giá vàng thế giới (XAU): ${data.price.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}USD/oz` +
          ` ~ ${worldPriceVNDPerLuong.toLocaleString('vi-VN', {
            maximumFractionDigits: 0
          })} VND/lượng (Tỷ giá: ${usdToVnd.toLocaleString(
            'vi-VN'
          )} VND/USD)</b>` +
          compareText;
      } else {
        worldGoldPriceDiv.textContent =
          'Không thể lấy giá vàng thế giới hoặc tỷ giá USD/VND.';
      }
    } catch (e) {
      worldGoldPriceDiv.textContent =
        'Không thể lấy giá vàng thế giới hoặc tỷ giá USD/VND.';
    }
  }
  fetchWorldGoldPriceAndCompare();
});

async function fetchGoldPriceHistory(goldPriceId, fromDate, toDate) {
  const response = await fetch(
    'https://sjc.com.vn/GoldPrice/Services/PriceService.ashx',
    {
      method: 'POST',
      headers: {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: `method=GetGoldPriceHistory&goldPriceId=${goldPriceId}&fromDate=${encodeURIComponent(
        fromDate
      )}&toDate=${encodeURIComponent(toDate)}`
    }
  );
  return await response.json();
}

function drawGoldChart(goldData) {
  if (!goldData || !goldData.length) return;

  // Sort by date ascending
  goldData.sort((a, b) => {
    const aTime = parseInt(a.GroupDate.match(/\d+/)[0], 10);
    const bTime = parseInt(b.GroupDate.match(/\d+/)[0], 10);
    return aTime - bTime;
  });

  const labels = goldData.map((item) => {
    const timestamp = parseInt(item.GroupDate.match(/\d+/)[0], 10);
    const date = new Date(timestamp);
    // Manually format: dd/MM/yyyy, HH:mm
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year}, ${hour}:${minute}`;
  });
  const buyValues = goldData.map((item) => item.BuyValue);
  const sellValues = goldData.map((item) => item.SellValue);

  const ctx = document.getElementById('goldChart').getContext('2d');
  // Destroy previous chart if exists
  if (window.goldChartInstance) {
    window.goldChartInstance.destroy();
  }
  window.goldChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Giá Mua',
          data: buyValues,
          borderColor: '#c0392b',
          backgroundColor: '#c0392b',
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 4
        },
        {
          label: 'Giá Bán',
          data: sellValues,
          borderColor: '#1a7f37',
          backgroundColor: '#1a7f37',
          fill: false,
          tension: 0.2,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: false,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) {
              return value.toLocaleString('vi-VN');
            }
          }
        }
      }
    }
  });
}
