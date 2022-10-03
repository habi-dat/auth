<template>
  <ag-grid-vue
    :localeText="aggridLocale.locale_de"
    :style="tableStyle"
    class="ag-theme-material"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :row-selection="rowSelection"
    :rowData="rowData"
    @grid-ready="onGridReadyHandler"
    @first-data-rendered="onFirstDataRendered"
    @selection-changed="selected => $emit('selectionChanged', gridApi.getSelectedRows())"
    @row-selected="onRowSelected"
    :pagination="true"
    paginationPageSize="25"
  />
</template>

<script>
import axios from 'axios'
import moment from 'moment'
import router from '../../router'
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import aggridLocale from '@/assets/ag-grid.locale.js';
import { AgGridVue } from "ag-grid-vue";
import ChipCell from '@/components/table/ChipCell'
import SelectCell from '@/components/table/SelectCell';
export default {
  name: 'UserTable',
  components: {
    AgGridVue,
    ChipCell,
    SelectCell
  },
  props: {
    users: Array,
    search: String,
    showGroups: Boolean,
    comboSelect: Boolean,
    selectCellItems: Array,
    groups: Array,
    heightOffset: Number,
    rowSelection: String
  },
  data () {
    return {
      tableStyle: "",
      defaultColDef: [],
      columnDefs: [],
      rowData: [],
      aggridLocale: aggridLocale,
      selectedRows: [],
      gridApi: null,
      columnApi: null
    }
  },
  watch: {
    search(newSearch, oldSearch) {
      this.gridApi.setQuickFilter(newSearch);
      this.gridApi.onFilterChanged();
    }
  },
  methods: {
    onGridReadyHandler(params) {
      this.gridApi = params.api;
      this.columnApi = params.columnApi;
      this.$emit('onGridReady', params);
    },
    onFirstDataRendered(params) {
      this.columnApi.autoSizeAllColumns();
      this.$emit('onDataRendered');
    },
    onRowSelected(event) {
      if (!this.comboSelect) {
        this.$emit('selectUser', event.node.data, event.node.isSelected())
      } else {
        this.$emit('selectUser', event.node.data, event.node.data.selectCell)
      }
    }
  },
  created() {
    this.tableStyle = "width: 100%; height: calc(100% - " + (this.heightOffset || 0) +"px);"
    var selectorCellDef;
    if (this.comboSelect) {
      selectorCellDef = { headerName: "", field: "selectCell", maxWidth: 50, cellRenderer: 'SelectCell', cellRendererParams: { items: this.selectCellItems},
        autoHeight: false
      }
    } else {
      selectorCellDef = { checkboxSelection: true, maxWidth: 50,
        cellStyle: {}};
    }
    var textStyle = { 'line-height': 'normal', 'padding-top': '14px', 'padding-bottom': '14px'}
    this.columnDefs = [
      selectorCellDef,
      { headerName: "ID", field: "uid", maxWidth: 200, cellStyle: textStyle},
      { headerName: "Anzeigename", field: "cn", maxWidth: 200, cellStyle: textStyle},
      { headerName: "E-Mail", field: "mail", maxWidth: 200, cellStyle: textStyle},
      { headerName: "Zugehörigkeit", field: "title", maxWidth: 200, cellStyle: textStyle},
      { headerName: "Ort", field: "l", maxWidth: 150, cellStyle: textStyle}
    ];

    const groupValueGetter = params => {
      return params.value.map(g => g.o).join(' ');
    }

    if (this.showGroups) {
      this.columnDefs.push(
        { headerName: "Mitglied in", field: "memberGroups", getQuickFilterText: groupValueGetter, cellStyle: {'white-space': 'normal'}, maxWidth: 300, autoHeight: true, cellRenderer: 'ChipCell', cellRendererParams: {  color: 'success', field: 'o', tooltip: 'group' }
        }
      )
      this.columnDefs.push(
        { headerName: "Admin von", field: "ownerGroups", cellStyle: {'white-space': 'normal'}, maxWidth: 300, autoHeight: true ,cellRenderer: 'ChipCell', cellRendererParams: {  color: 'info', field: 'o', tooltip: 'group' }
        }
      )
    }
    this.defaultColDef = {
      resizable: true,
      filterable: true,
      sortable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 'word-break': 'normal'}
    };
    this.rowData = this.users;

  },
}
</script>
