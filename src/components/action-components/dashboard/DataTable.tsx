/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type StatusOption = { label: string; value: string };

const DataTable = <TData,>({
  columns,
  data,
  statuses,
  currentTab,
  prioritizePaid = false,
}: {
  columns: any[];
  data: TData[];
  statuses?: StatusOption[]; // optional for AllInvoices
  currentTab?: "buyer" | "seller";
  prioritizePaid?: boolean;
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Filter columns if `currentTab` exists
  const filteredColumns = useMemo(() => {
    if (!currentTab) return columns;
    return columns.filter((column) => {
      if (currentTab !== "buyer" && column.accessorKey === "seller") {
        return false;
      }
      if (currentTab === "buyer" && column.accessorKey === "buyer") {
        return false;
      }
      return true;
    });
  }, [columns, currentTab]);

  // Search + optional status filter
  const filteredData = useMemo(() => {
    return data.filter((row: any) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        row.id?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        !statuses ||
        statusFilter === "ALL" ||
        row.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [data, searchQuery, statusFilter, statuses]);

  // Optional prioritization of "PAID" status
  const sortedData = useMemo(() => {
    if (!prioritizePaid) return filteredData;
    const paid = filteredData
      .filter((row: any) => row.status === "PAID")
      .reverse();
    const others = filteredData.filter((row: any) => row.status !== "PAID");
    return [...paid, ...others];
  }, [filteredData, prioritizePaid]);

  const table = useReactTable({
    data: sortedData,
    columns: filteredColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center py-4 gap-4">
        <Input
          placeholder="Search by ID..."
          className="max-w-md"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {statuses && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-md w-52"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell ?? "",
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={filteredColumns.length}
                  className="text-center"
                >
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default DataTable;
