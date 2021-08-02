import {
  InvoiceStatusEnum,
  InvoiceTypeEnum,
} from '@clodeo-internal-finance/shared/constants/invoice/invoice.enum';
import { Invoice } from '@clodeo-internal-finance/shared/models/invoices/domain/invoice.domain';
import { TransactionInvoiceSummaryBySeller } from '@clodeo-internal-finance/shared/models/transactions/domain/transaction-invoice-summary.domain';
import { OpenTelemetryTrace } from '@clodeo/library-node/decorators/open-telemetry-trace.decorator';
import { SentryAware } from '@clodeo/library-node/decorators/sentry-aware.decorator';

interface InvoiceDocumentData {
  Data: Invoice;
  Summary: TransactionInvoiceSummaryBySeller;
}

@OpenTelemetryTrace()
@SentryAware()
export class PrepareTemplateService {
  private static formatCurrency(numb: number) {
    const format = numb.toString().split('').reverse().join('');
    const convert = format.match(/\d{1,3}/g);
    const rupiah = 'Rp ' + convert.join('.').split('').reverse().join('');
    // console.log(rupiah)
    return rupiah;
  }

  static prepareInvoiceDocumentTemplate(data: InvoiceDocumentData) {
    if (!data.Summary) {
      throw new Error('Please provide summary before generate document.');
    }

    if (!data.Data) {
      throw new Error('Please provide data before generate document.');
    }

    // Fungsi convert UTC to DD-MM-YYYY
    function formatDate(dateString: string) {
      const date = new Date(dateString);
      date.setHours(date.getHours() + 7);
      var a = 'a';

      // const allDate = dateString.split(' ');
      const allDate = date.toISOString().split('T');
      const thisDate = allDate[0].split('-');
      const thisTime = allDate[1].split(':');
      const newDate = [thisDate[2], thisDate[1], thisDate[0]].join('-');

      const suffix = +thisTime[0] >= 12 ? 'PM' : 'AM';
      const hour = +thisTime[0] > 12 ? +thisTime[0] - 12 : +thisTime[0];
      const hourStr = hour < 10 ? '0' + hour : hour;
      const min = thisTime[1];
      const sec = thisTime[2];
      const newTime = hourStr + ':' + min + suffix;
      return newDate + ' ' + newTime;
    }

    const summaryData = data.Summary;
    const documentData = data.Data;

    const isProforma = documentData.Type == InvoiceTypeEnum.Proforma;

    const docTitle = isProforma ? 'Proforma Invoice' : 'Invoice';
    const docNumber = isProforma
      ? documentData.ProformaNumber
      : documentData.InvoiceNumber;
    let docDate = isProforma
      ? documentData.ProformaDateUtc
      : documentData.InvoiceDateUtc;
    docDate = formatDate(docDate);
    let docDueDate = isProforma
      ? documentData.ProformaRevisionDeadlineDateUtc
      : documentData.InvoiceDueDateUtc;
    docDueDate = formatDate(docDueDate);
    const docRevCounter = documentData.ProformaRevisionCounter;
    const isWaiting = documentData.InvoiceStatus == InvoiceStatusEnum.Waiting;
    // const isPaid = documentData.PaymentDateUtc ? true : false;
    // const isGracePeriod = new Date() > new Date(documentData.InvoiceDueDateUtc);
    const invoiceStatus = isWaiting ? 'Menunggu Pembayaran' : 'Lunas';

    const courierSummary = data.Summary?.CourierSummary;
    if (!Array.isArray(courierSummary) || courierSummary.length <= 0) {
      throw new Error(
        'Please provide courier summary before generate document.',
      );
    }

    const documentHeader = `
    <div class="flex-50">
        <h4 class="title-summary">${docTitle}</h4>
        <div class="flex-container">
            <div class="flex-40">
                ${
                  isProforma
                    ? `
                  <p class="text-value-summary">No Proforma</p>
                  <p class="text-value-summary">Tanggal</p>
                  <p class="text-value-summary">Deadline Revisi</p>
                  <p class="text-value-summary">Revisi Ke</p>
                  `
                    : `
                  <p class="text-value-summary">No Invoice}</p>
                  <p class="text-value-summary">Tanggal</p>
                  <p class="text-value-summary">Status</p>
                  <p class="text-value-summary">Due Date</p>
                  `
                }

            </div>
            <div class="flex-60">
                ${
                  isProforma
                    ? `
                <p class="text-value-summary">: <span id="proforma-number-1" class="pl-2">${docNumber}</span></p>
                <p class="text-value-summary">: <span id="invoice-date" class="pl-2">${docDate}</span></p>
                <p class="text-value-summary">: <span id="due-date" class="pl-2">${docDueDate}</span></p>
                <p class="text-value-summary">: <span id="revision-number" class="pl-2">${docRevCounter}</span></p>
                `
                    : `
                <p class="text-value-summary">: <span id="proforma-number-1" class="pl-2">${docNumber}</span></p>
                <p class="text-value-summary">: <span id="invoice-date" class="pl-2">${docDate}</span></p>
                <p class="text-value-summary">: <span id="revision-number" class="pl-2">${invoiceStatus}</span></p>
                <p class="text-value-summary">: <span id="due-date" class="pl-2">${docDueDate}</span></p>
                `
                }
            </div>
        </div>
    </div>
    `;

    const tenantInfo = `
    <div class="flex-50">
        <h4 class="title-summary">Ditagihkan Kepada</h4>
        <div class="flex-container">
            <div class="flex-40">
                <p class="text-value-summary">Tenant ID</p>
                <p class="text-value-summary">Nama Tenant</p>
                <p class="text-value-summary" style="visibility: hidden;">Name Tenant</p>
                <p class="text-value-summary">No. Telepon</p>
            </div>
            <div class="flex-60">
                <p class="text-value-summary">: <span id="tenantid" class="pl-2">${summaryData.TenantId}</span></p>
                <p class="text-value-summary">: <span id="tenant-name" class="pl-2">${summaryData.Tenant.CompanyName}</span></p>
                <p class="text-value-summary"><span id="tenant-name" style="padding-left: 8px;">${summaryData.Tenant.FullName}</span></p>
                <p class="text-value-summary">:<span id="phone-number" class="pl-2"></span>${summaryData.Tenant.PhoneNumber}</p>
            </div>
        </div>
    </div>
    `;

    let dataTable = ``;
    courierSummary.forEach((courier) => {
      dataTable += '<tr>'; // tag Tr opening
      dataTable +=
        '<td>' +
        "<img style='width: 100px; height: 40px' src='https://nx-design-system-web-development.clodeo.com/img/logo/courier/code/" +
        courier.CourierCode +
        ".svg'>" +
        '</td>'; // Kurir
      dataTable += '<td>' + courier.TotalOrder + '</td>'; // Qty (Masih Dummy)
      dataTable +=
        '<td>' + this.formatCurrency(courier.FixShippingCharge) + '</td>'; // Tagihan
      dataTable +=
        '<td>' + this.formatCurrency(courier.ShippingChargeDiscount) + '</td>'; // Potongan
      dataTable +=
        '<td>' +
        this.formatCurrency(courier.ShippingChargeDiscountTax) +
        '</td>'; // PPh 23
      dataTable +=
        '<td>' + this.formatCurrency(courier.FixInsuranceAmount) + '</td>'; // Asuransi
      dataTable +=
        '<td>' +
        this.formatCurrency(courier.TotalShippingCharge) +
        '</td></tr>'; // Subtotal + inlude tag Tr Closing
    });

    return `
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dokumen Proforma</title>
</head>
<style>
    .container {
        margin: 10px;
    }

    #billing {
        font-family: Arial, Helvetica, sans-serif;
        border-collapse: collapse;
        width: 100%;
    }

    .no-proforma {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: normal;
        font-size: 10px;
        line-height: 100%;
        /* identical to box height, or 10px */

        /* display: flex;
align-items: center; */
        letter-spacing: 0.01em;
    }

    #billing td,
    #billing th {
        border-bottom: 1px solid #ddd;
        padding: 8px;
        font-family: Noto Sans;
        font-style: normal;
        font-weight: normal;
        font-size: 10px;
        line-height: 100%;
        /* identical to box height, or 10px */
        letter-spacing: 0.01em;

        color: #000000;
    }

    #billing tr:nth-child(even) {
        background-color: white;
    }

    /* #billing tr:hover {background-color: #ddd;} */

    #billing th {
        padding-top: 12px;
        padding-bottom: 12px;
        text-align: left;
        background-color: #F0F2F3;
        font-family: Noto Sans;
        font-style: italic;
        font-weight: normal;
        font-size: 11px;
        line-height: 100%;
        /* identical to box height, or 11px */

        letter-spacing: 0.01em;

        color: #000000;
    }

    .flex-container {
        display: flex;
        flex-direction: row;
    }

    .flex-left {
        flex: 55%;
    }

    .flex-right {
        flex: 45%;
    }

    .bg-gray {
        background-color: #DBE0E3;
    }

    .text-title {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: bold;
        font-size: 24px;
        line-height: 0.1;
        /* identical to box height, or 24px */


        letter-spacing: 0.01em;

        /* Neutral/6 */

        color: #62717D;
    }

    .text-center {
        text-align: center;
    }

    .no-proforma {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: normal;
        font-size: 10px;
        /* identical to box height, or 10px */


        align-items: center;
        text-align: center;
        letter-spacing: 0.01em;

        /* Neutral/6 */

        color: #62717D;
    }

    .text-company {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: bold;
        font-size: 12px;
        line-height: 100%;
        /* identical to box height, or 12px */

        display: flex;
        align-items: center;
        letter-spacing: 0.01em;

        color: #000000;
    }

    .company-address {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: normal;
        font-size: 10px;
        line-height: 100%;
        /* identical to box height, or 10px */

        display: flex;
        align-items: center;
        letter-spacing: 0.01em;

        color: #000000;
    }

    .flex-50 {
        flex: 50%;
    }

    .title-summary {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: bold;
        font-size: 12px;
        line-height: 100%;
        /* identical to box height, or 12px */

        display: flex;
        align-items: center;
        letter-spacing: 0.01em;

        color: #000000;
    }

    .flex-10 {
        flex: 10%;
    }

    .flex-20 {
        flex: 20%;
    }

    .flex-30 {
        flex: 30%;
    }

    .flex-40 {
        flex: 40%;
    }

    .flex-60 {
        flex: 60%;
    }

    .flex-70 {
        flex: 70%;
    }

    .flex-80 {
        flex: 80%;
    }

    .flex-90 {
        flex: 90%;
    }

    .text-value-summary {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: normal;
        font-size: 10px;
        line-height: 100%;
        /* identical to box height, or 10px */

        display: flex;
        align-items: center;
        letter-spacing: 0.01em;

        color: #000000;
    }

    .mt-2 {
        margin-top: 20px;
    }

    .title-total-bill {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: normal;
        font-size: 12px;
        line-height: 100%;
        /* identical to box height, or 12px */

        display: flex;
        align-items: center;
        text-align: right;
        letter-spacing: 0.01em;

        color: #000000;
    }

    .pl-2 {
        padding-left: 5px;
    }

    .value-total-bill {
        font-family: Noto Sans;
        font-style: normal;
        font-weight: bold;
        font-size: 12px;
        line-height: 100%;
        /* identical to box height, or 12px */

        display: flex;
        align-items: center;
        text-align: right;
        letter-spacing: 0.01em;

        color: #000000;
    }
</style>

<body>
    <div class="container">
        <div class="flex-container">
            <div class="flex-left">
                <img style="padding-top: 10px;" class="img-left"
                    src="https://nx-design-system-web-development.clodeo.com/img/logo/clodeo/regular.svg">
                <p class="text-company">PT. Clodeo Indonesia Jaya</p>
                <p class="company-address">Jl. Buah Batu No. 105 A-B, Bandung, Jawa Barat 40265</p>
            </div>
            <div class="flex-right bg-gray">
                <p class="text-title " style="text-align: center; padding-top: 10px;">${docTitle}</p>
                <p class="no-proforma"><span id="proforma-number"> ${docNumber}</span></p>
            </div>
        </div>
        <div class="flex-container mt-2">
            ${documentHeader}
            ${tenantInfo}
        </div>
        <div class="table" style="margin-top: 20px;">
            <table id="billing">
                <tr>
                    <th>Kurir</th>
                    <th>Qty</th>
                    <th>Tagihan</th>
                    <th>Potongan</th>
                    <th>PPh 23</th>
                    <th>Asuransi</th>
                    <th>Sub Total</th>
                </tr>
                <tbody id="data-table">
                  ${dataTable}
                </tbody>
            </table>
            <div class="flex-container">
                <div class="flex-60"></div>
                <div class="flex-40">
                    <div class="flex-container">
                        <div class="flex-60">
                            <h3 class="title-total-bill">Total Tagihan</h3>
                        </div>
                        <div class="flex-40">
                            <h3 class="value-total-bill"><span id="total-tagihan" class="pl-2">${this.formatCurrency(
                              data.Summary.TotalShippingCharge,
                            )}</span></h3>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="footer-dokumen-proforma">
            <p class="text-value-summary">Jika ada kesalahan mohon segera menghubungi pihak clodeo.</p>
            <p class="text-value-summary">Customer Support</p>
            <div class="flex-container">
                <div class="flex-40">
                    <div class="flex-container">
                        <div class="flex-40">
                            <p class="text-value-summary">Whatsapp</p>
                            <p class="text-value-summary">Email</p>
                        </div>
                        <div class="flex-60">
                            <p class="text-value-summary">: +62 878 9775 900</p>
                            <p class="text-value-summary">: support@clodeo.com</p>
                        </div>
                    </div>
                </div>
                <div class="flex-60"></div>
            </div>
        </div>
    </div>
</body>
<!-- <script src="./test.js"></script> -->
<script >
    // initialData(dataBang)
    // Init variable data
    var data;
    function initialData(dataProforma) {
        data = dataProforma
    }


    // Fungsi format rupiah
    function formatCurrency(numb) {
        const format = numb.toString().split('').reverse().join('');
        const convert = format.match(/\d{1,3}/g);
        const rupiah = 'Rp ' + convert.join('.').split('').reverse().join('')
        // console.log(rupiah)
        return rupiah;
    }

    // Fungsi convert UTC to DD-MM-YYYY
    function formatDate(dateString)
    {
        var allDate = dateString.split(' ');
        var thisDate = allDate[0].split('-');
        var thisTime = allDate[1].split(':');
        var newDate = [thisDate[2],thisDate[1],thisDate[0] ].join("-");

        var suffix = thisTime[0] >= 12 ? "PM":"AM";
        var hour = thisTime[0] > 12 ? thisTime[0] - 12 : thisTime[0];
        var hour =hour < 10 ? "0" + hour : hour;
        var min = thisTime[1] ;
        var sec = thisTime[2] ;
        var newTime = hour + ':' + min + suffix;
        return newDate + ' ' + newTime;
    }

    const courierSummary = data.Summary.CourierSummary

    // Looping to show data in table
    var temp = "";
    courierSummary.forEach((datas) => {
        temp += "<tr>"; // tag Tr opening
        temp += "<td>" + "<img style='width: 100px; height: 40px' src='https://nx-design-system-web-development.clodeo.com/img/logo/courier/code/" + datas.CourierCode + ".svg'>" + "</td>"; // Kurir
        temp += "<td>" + 1 + "</td>"; // Qty (Masih Dummy)
        temp += "<td>" + formatCurrency(datas.FixShippingCharge) + "</td>"; // Tagihan
        temp += "<td>" + formatCurrency(datas.ShippingChargeDiscount) + "</td>"; // Potongan
        temp += "<td>" + formatCurrency(datas.ShippingChargeDiscountTax) + "</td>"; // PPh 23
        temp += "<td>" + formatCurrency(datas.FixInsuranceAmount) + "</td>"; // Asuransi
        temp += "<td>" + formatCurrency(datas.TotalShippingCharge) + "</td></tr>"; // Subtotal + inlude tag Tr Closing
    });
    // Tenant Data
    document.getElementById('data-table').innerHTML = temp;
    document.getElementById("proforma-number").innerHTML = " " + data.Data.InvoiceNumber;
    document.getElementById("proforma-number-1").innerHTML = data.Data.InvoiceNumber;
    document.getElementById("invoice-date").innerHTML = formatDate(data.Data.InvoiceDateUtc);
    document.getElementById("due-date").innerHTML = formatDate(data.Data.InvoiceDueDateUtc);
    document.getElementById("revision-number").innerHTML = data.Data.ProformaRevisionCounter;
    document.getElementById("tenantid").innerHTML = "" + data.Tenant.Id;
    document.getElementById("tenant-name").innerHTML = data.Tenant.UserName;
    document.getElementById("phone-number").innerHTML = data.Tenant.PhoneNumber;
    document.getElementById("total-tagihan").innerHTML = formatCurrency(data.Summary.TotalShippingCharge)
    console.log(data.Data.InvoiceDateUtc.toUTCString())
</script>
</html>`;
  }

  static prepareInvoiceAttachmentTemplate(data: InvoiceDocumentData) {
    if (!data.Summary) {
      throw new Error('Please provide summary before generate document.');
    }

    if (!data.Data) {
      throw new Error('Please provide data before generate document.');
    }

    const summaryData = data.Summary;
    const documentData = data.Data;

    const isProforma = documentData.Type == InvoiceTypeEnum.Proforma;

    const docTitle = isProforma ? 'Proforma Invoice' : 'Invoice';
    const docNumber = isProforma
      ? documentData.ProformaNumber
      : documentData.InvoiceNumber;

    const courierSummary = summaryData.CourierSummary;

    function thousandSeparator(number: number, separator = ',') {
      return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    }


    // Loop total courier
    let x = '';
    courierSummary.map((courierData, i) => {
      const { CourierCode, TotalShippingCharge, TransactionSummary } = courierData;

      // x = x + "<h" + i + ">Heading " + i + "</h" + i + ">";
      x +=
        "<div style='margin-top: 30px' id='courier-logo'>" +
        "<img style='width: 100px; height: 40px' src='https://nx-design-system-web-development.clodeo.com/img/logo/courier/code/" +
        CourierCode +
        ".svg'></div>";
      x += "<div id='billing-table' style='margin-top: 30px'>";
      x += "<table id='billing'>";
      x += '<tr>';
      x += '<th>No</th>';
      x += '<th>No Resi</th>';
      x += '<th>Berat (gr)</th>';
      x += '<th>Ongkos Kirim</th>';
      x += '<th>Potongan</th>';
      x += '<th>PPh 23</th>';
      x += '<th>Asuransi</th>';
      x += '<th>Tagihan</th>';
      x += '</tr>';
      TransactionSummary.forEach((trxData, index) => {
        x += '<tr><td>' + (index + 1) + '</td>'; // No
        x += '<td>' + trxData.ShippingTrackingNumber + '</td>'; // No Resi
        x += '<td>' + thousandSeparator(trxData.FixWeight * 1000, ',') + '</td>'; // Berat Masih dumy
        x += '<td>' + this.formatCurrency(trxData.FixShippingCharge) + '</td>'; // Ongkos Kirim
        x +=
          '<td>' +
          this.formatCurrency(trxData.ShippingChargeDiscount) +
          '</td>'; // Diskon
        x +=
          '<td>' +
          this.formatCurrency(trxData.ShippingChargeDiscountTax) +
          '</td>'; // PPh 23
        x += '<td>' + this.formatCurrency(trxData.FixInsuranceAmount) + '</td>'; // Asuransi
        x +=
          '<td>' +
          this.formatCurrency(trxData.TotalShippingCharge) +
          '</td></tr>'; // Tagihan
      });
      x += '</table>';
      x += "<div class='flex-container'>";
      x += "<div class='flex-60'></div>";
      x += "<div class='flex-40'>";
      x += '<div class="flex-container">';
      x +=
        '<div class="flex-60"><h3 class="title-total-bill">Total Tagihan</h3></div>';
      x +=
        '<div class="flex-40"><h3 class="value-total-bill">' +
        this.formatCurrency(TotalShippingCharge) +
        '</h3></div>';
      x += '</div>';
      x += '</div>';
      x += '</div>';
      x += '</div>';
    });

    return `
    <!DOCTYPE html>
    <html lang="en">

    <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lampiran Proforma</title>
        <style>
            #billing {
                font-family: Arial, Helvetica, sans-serif;
                border-collapse: collapse;
                width: 100%;
            }

            .no-proforma {
                font-family: Noto Sans;
                font-style: normal;
                font-weight: normal;
                font-size: 10px;
                line-height: 100%;
                /* identical to box height, or 10px */

                /* display: flex;
    align-items: center; */
                letter-spacing: 0.01em;
            }

            #billing td,
            #billing th {
                border-bottom: 1px solid #ddd;
                padding: 8px;
                font-family: Noto Sans;
                font-style: normal;
                font-weight: normal;
                font-size: 10px;
                line-height: 100%;
                /* identical to box height, or 10px */
                letter-spacing: 0.01em;

                color: #000000;
            }

            #billing tr:nth-child(even) {
                background-color: white;
            }

            /* #billing tr:hover {background-color: #ddd;} */

            #billing th {
                padding-top: 12px;
                padding-bottom: 12px;
                text-align: left;
                background-color: #F0F2F3;
                font-family: Noto Sans;
                font-style: italic;
                font-weight: normal;
                font-size: 11px;
                line-height: 100%;
                /* identical to box height, or 11px */

                letter-spacing: 0.01em;

                color: #000000;
            }

            .text-right {
                position: absolute;
                right: 10px;
            }

            .flex-container {
                display: flex;
                flex-direction: row;
            }

            .flex-10 {
                flex: 10%;
            }

            .flex-20 {
                flex: 20%;
            }

            .flex-30 {
                flex: 30%;
            }

            .flex-40 {
                flex: 40%;
            }

            .flex-50 {
                flex: 50%;
            }

            .flex-60 {
                flex: 60%;
            }

            .flex-70 {
                flex: 70%;
            }

            .flex-80 {
                flex: 80%;
            }

            .flex-90 {
                flex: 90%;
            }

            .container {
                margin: 10px;
            }

            .bg-red {
                background-color: red;
            }

            .pl-1 {
                padding-left: 10px;
            }

            .pl-2 {
                padding-left: 20px;
            }

            .title-total-bill {
                font-family: Noto Sans;
                font-style: normal;
                font-weight: normal;
                font-size: 12px;
                line-height: 100%;
                /* identical to box height, or 12px */

                display: flex;
                align-items: center;
                text-align: right;
                letter-spacing: 0.01em;

                color: #000000;
            }

            .value-total-bill {
                font-family: Noto Sans;
                font-style: normal;
                font-weight: bold;
                font-size: 12px;
                line-height: 100%;
                /* identical to box height, or 12px */

                display: flex;
                align-items: center;
                text-align: right;
                letter-spacing: 0.01em;

                color: #000000;
            }
        </style>
    </head>

    <body>
        <div class="container ">
            <div>
                <h3 class="no-proforma">No. ${docTitle}: <span id="proforma-number">${docNumber}</span></h3>
                <div id="proforma-list">${x}</div>
            </div>
    </body>
    <script src="./test.js"></script>
    <script>
        var data;
        function initialData(dataProforma) {
            data = dataProforma
        }

        // fungsi convert rupiah
        function formatCurrency(numb) {
            const format = numb.toString().split('').reverse().join('');
            const convert = format.match(/\d{1,3}/g);
            const rupiah = 'Rp ' + convert.join('.').split('').reverse().join('')
            return rupiah;
        }

        const courierSummary = data.Summary.CourierSummary
        // Loop total courier
        var x = "", i;
        const table = document.getElementById("billing-table")
        courierSummary.map((datas, i) => {
            // x = x + "<h" + i + ">Heading " + i + "</h" + i + ">";
            x += "<div style='margin-top: 30px' id='courier-logo'>" + "<img style='width: 100px; height: 40px' src='https://nx-design-system-web-development.clodeo.com/img/logo/courier/code/" + datas.CourierCode + ".svg'></div>"
            x += "<div id='billing-table' style='margin-top: 30px'>"
            x += "<table id='billing'>";
            x += "<tr>";
            x += "<th>No</th>";
            x += "<th>No Resi</th>";
            x += "<th>Berat (gr)</th>";
            x += "<th>Ongkos Kirim</th>";
            x += "<th>Potongan</th>";
            x += "<th>PPh 23</th>";
            x += "<th>Asuransi</th>";
            x += "<th>Tagihan</th>";
            x += "</tr>"
            datas.TransactionSummary.forEach((courierDatas, index) => {
                x += "<tr><td>"+ (index+1) +"</td>"; // No
                x += "<td>" + courierDatas.ShippingTrackingNumber +"</td>"; // No Resi
                x += "<td>" + 1 +"</td>"; // Berat Masih dumy
                x += "<td>" + formatCurrency(courierDatas.FixShippingCharge) +"</td>"; // Ongkos Kirim
                x += "<td>" + formatCurrency(courierDatas.ShippingChargeDiscount) +"</td>"; // Diskon
                x += "<td>" + formatCurrency(courierDatas.ShippingChargeDiscountTax) +"</td>"; // PPh 23
                x += "<td>" + formatCurrency(courierDatas.FixInsuranceAmount) +"</td>"; // Asuransi
                x += "<td>" + formatCurrency(courierDatas.TotalShippingCharge) +"</td></tr>"; // Tagihan
            });
            x += "</table>"
            x += "<div class='flex-container'>";
            x += "<div class='flex-60'></div>"
            x += "<div class='flex-40'>"
            x += '<div class="flex-container">';
            x += '<div class="flex-60"><h3 class="title-total-bill">Total Tagihan</h3></div>'
            x += '<div class="flex-40"><h3 class="value-total-bill">'+ formatCurrency(datas.TotalShippingCharge) +'</h3></div>'
            x += '</div>'
            x += "</div>"
            x += "</div>"
            x += "</div>"
        })
        document.getElementById("proforma-list").innerHTML = x
        document.getElementById("proforma-number").innerHTML = data.Data.InvoiceNumber;


        document.getElementById("datas").innerHTML = ''
    </script>

    </html>
    `;
  }
}
