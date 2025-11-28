describe("API test", () => {
  test("mock API returns success", async () => {
    const mockApi = () =>
      Promise.resolve({ status: 200, message: "OK" });

    const response = await mockApi();
    expect(response.status).toBe(200);
  });
});
