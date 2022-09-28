<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%">
    <Toolbar title="Einladungen" icon="email" search :searchText.sync="search">
      <template #right>
        <ToolbarButton
          icon="refresh"
          tooltip="Einladung(en) erneut senden"
          color="primary"
          @click="repeatInvites"
          :disabled="selectedRows.length === 0"
        />
        <ToolbarButton
          icon="delete"
          tooltip="Einladung(en) löschen"
          color="error"
          @click="deleteInvites"
          :disabled="selectedRows.length === 0"
        />
        <ToolbarButton
          icon="add"
          tooltip="Einladung verschicken"
          color="success"
          to="/invite"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height:100%">
      <ag-grid-vue
        :localeText="aggridLocale.locale_de"
        style="width: 100%; height: 100%"
        class="ag-theme-material"
        :defaultColDef="defaultColDef"
        :columnDefs="columnDefs"
        :rowData="rowData"
        rowSelection="multiple"
        :isRowSelectable="inviteSelectable"
        :getRowId="getRowId"
        @grid-ready="onGridReady"
        @first-data-rendered="onFirstDataRendered"
        @selection-changed="onSelectionChanged"
        :pagination="true"
        paginationPageSize="25"
      >
    </ag-grid-vue>
    </v-card-text>
    <ConfirmDialog ref="confirm" />
  </v-card>
</template>

<script>
import axios from 'axios'
import moment from 'moment'
import router from '../../router'
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import aggridLocale from '@/assets/ag-grid.locale.js';
import { AgGridVue } from "ag-grid-vue";
import ChipCell from '@/components/table/ChipCell';
import ConfirmDialog from '@/components/ConfirmDialog'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'
export default {
  name: 'Invites',
  components: {
    AgGridVue,
    ChipCell,
    ConfirmDialog,
    ToolbarButton,
    Toolbar
  },
  data () {
    return {
      defaultColDef: [],
      columnDefs: [],
      rowData: [],
      aggridLocale: aggridLocale,
      selectedRows: [],
      search: '',
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
    onGridReady(params) {
      this.gridApi = params.api;
      this.columnApi = params.columnApi;
    },
    onFirstDataRendered(params) {
      this.columnApi.autoSizeAllColumns()
    },
    onSelectionChanged() {
      this.selectedRows = this.gridApi.getSelectedRows();
    },
    getRowId(params) {
      return params.data.token;
    },
    transformInvites(invites) {
      return invites.map(invite => {
        return {
          mail: invite.data.mail,
          expires: moment(invite.expires),
          invitedBy: invite.currentUser.cn,
          created: moment(invite.created),
          member: invite.data.member.map(item => {return {
            dn: item,
            cn: item.split(',')[0].split('=')[1]
          }}),
          owner: invite.data.owner.map(item => {return {
            dn: item,
            cn: item.split(',')[0].split('=')[1]
          }}),
          data: invite.data,
          currentUser: invite.currentUser,
          token: invite.token
        }
      })
    },
    getInvites: function () {
      let self = this
      axios.get('/api/user/invites')
        .then(response => {
          this.rowData = self.transformInvites(response.data.invites)
          return rowData;
        })
        .catch(error => {})
    },
    inviteSelectable(params) {
      var user = this.$store.state.user
      var groups = [].concat(params.data.data.owner).concat(params.data.data.member);
      var selectable = true;
      if (user.isGroupAdmin && !user.isAdmin
        && params.data.currentUser.dn !== user.dn
        && groups.length > 0) {
        groups.forEach(group => {
          if (!user.owner.includes(group)) {
            selectable = false;
          }
        })
      }
      return selectable;
    },
    async deleteInvites() {
      var emails = this.selectedRows.map(row => { return row.mail}).join(', ');
      if (
          await this.$refs.confirm.open(
            'Bist du sicher?',
            'Willst du die Einladung(en) an ' + emails + ' wirklich löschen?'
          )
        ) {
          axios.delete('/api/user/invites', {data: {tokens: this.selectedRows.map(row => { return row.token})}})
            .then(response => {
              this.$snackbar.success('Einladung(en) an ' + emails + ' gelöscht')
              this.gridApi.applyTransaction({ remove: this.selectedRows});
            })
        }
    },
    repeatInvites() {
      var emails = this.selectedRows.map(row => { return row.mail}).join(', ');
      axios.put('/api/user/invites/repeat', {tokens: this.selectedRows.map(row => { return row.token})})
        .then(response => {
          this.$snackbar.success('Einladung(en) an ' + emails + ' erneut gesendet')
          this.gridApi.applyTransaction({ update: this.transformInvites(response.data.invites)});
        })
    }
  },
  created() {
    var textStyle = { 'line-height': 'normal', 'padding-top': '14px', 'padding-bottom': '14px'}
    this.columnDefs = [
      { checkboxSelection: true, maxWidth: 50},
      { headerName: "E-Mail Adresse", cellStyle: textStyle, field: "mail"},
      { headerName: "Eingeladen von", cellStyle: textStyle, field: "invitedBy"},
      { headerName: "Eingeladen am", cellStyle: textStyle, field: "created",
        valueFormatter: function (params) {
          return moment(params.value).format('DD.MM.YYYY');
          }
      },
      { headerName: "Gültig bis", cellStyle: textStyle, field: "expires",
        valueFormatter: function (params) {
          return moment(params.value).format('DD.MM.YYYY');
        }
      },
      { headerName: "Mitglied in", field: "member", cellStyle: {'white-space': 'normal'}, maxWidth: 250, autoHeight: true,cellRenderer: 'ChipCell', cellRendererParams: {  color: 'success', field: 'cn', tooltip: 'group'}
      },
      { headerName: "Admin von", field: "owner", cellStyle: {'white-space': 'normal'}, maxWidth: 250, autoHeight: true, cellRenderer: 'ChipCell', cellRendererParams: {  color: 'info', field: 'cn', tooltip: 'group' }
      }
    ];
    this.defaultColDef = {
      filter: true,
      sortable: true,
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 'word-break': 'normal'}
    };
    this.getInvites()
  },
}
</script>