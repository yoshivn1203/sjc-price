document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('price-body');
  const errorDiv = document.getElementById('error');
  const lastUpdated = document.getElementById('last-updated');
  const spinner = document.getElementById('spinner');

  spinner.style.display = 'block';

  // await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    const response = await fetch(
      'https://sjc.com.vn/GoldPrice/Services/PriceService.ashx'
    );
    const data = await response.json();

    if (data.success) {
      lastUpdated.textContent = `Bảng giá được cập nhật lúc: ${new Date().toLocaleString()}, và chỉ mang tính chất tham khảo`;

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
    } else {
      throw new Error('API request failed');
    }
  } catch (error) {
    errorDiv.textContent = 'Error fetching data: ' + error.message;
    errorDiv.style.display = 'block';
  } finally {
    spinner.style.display = 'none';
  }
});
